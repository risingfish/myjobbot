import type { Settings } from "../config/schema.js";
import { describeError } from "../errors.js";
import { HttpStatusError, NetworkError } from "./errors.js";
import type { Clock } from "./clock.js";
import { HostLimiter } from "./limiter.js";
import { readCapped } from "./readCapped.js";

const MS_PER_SECOND = 1000;
const BASE_BACKOFF_MS = 1000;
const JITTER_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_TYPES = ["text/html", "application/xhtml+xml"];
const TEXT_HEADERS = { "user-agent": "myjobbot (+careers lookup)" };
const JSON_HEADERS = { "content-type": "application/json", accept: "application/json" };

export interface JsonGetter {
    getJson(url: string, headers?: Record<string, string>): Promise<unknown>;
}

export interface JsonPoster {
    postJson(url: string, body: unknown): Promise<unknown>;
}

export interface TextPage {
    url: string;
    html: string;
    cut: boolean;
}

export type TextResult = TextPage | { redirect: string };

export interface TextGetter {
    getText(url: string, options: { maxBytes: number }): Promise<TextResult>;
}

interface HttpDeps {
    config: Settings["http"];
    clock: Clock;
    fetchFn: (url: string, init: RequestInit) => Promise<Response>;
    random: () => number;
}

export class HttpClient implements JsonGetter, TextGetter {
    private readonly limiter: HostLimiter;

    /** Builds the HTTP client, wiring up its per-host rate limiter from the given config and clock. */
    constructor(private readonly deps: HttpDeps) {
        this.limiter = new HostLimiter(deps.config, deps.clock);
    }

    /** Fetches a URL as JSON, retrying on transient failures and rate limits per the configured policy. */
    getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
        return this.json(url, { headers });
    }

    /** Returns a JSON client that fails on a redirect instead of following it, for addresses checked before each request. */
    withoutRedirects(): JsonGetter & JsonPoster {
        return {
            getJson: (url, headers = {}) => this.json(url, { headers, redirect: "manual" }),
            postJson: (url, body) => this.json(url, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body), redirect: "manual" }),
        };
    }

    /** Fetches an HTML page without following redirects, reading at most maxBytes, so callers can vet each hop. */
    async getText(url: string, options: { maxBytes: number }): Promise<TextResult> {
        const response = await this.request(url, { headers: TEXT_HEADERS, redirect: "manual" });
        const location = response.headers.get("location");
        if (REDIRECT_STATUSES.has(response.status) && location !== null) {
            await response.body?.cancel();
            return { redirect: new URL(location, url).href };
        }
        if (!isHtml(response.headers.get("content-type"))) {
            await response.body?.cancel();
            throw new Error(`GET ${url} is not an HTML page`);
        }
        const { body, cut } = await this.withUrl(`GET ${url}`, () => readCapped(response, options.maxBytes));
        return { url, html: body, cut };
    }

    /** Sends a request and reads its JSON answer, refusing a redirect the request asked not to follow. */
    private async json(url: string, init: RequestInit): Promise<unknown> {
        const label = `${init.method ?? "GET"} ${url}`;
        const response = await this.request(url, init);
        if (REDIRECT_STATUSES.has(response.status)) {
            await response.body?.cancel();
            throw new Error(`${label} was redirected; redirects aren't followed here`);
        }
        return this.withUrl(label, () => response.json());
    }

    /** Sends a request, retrying transient failures, and returns the first successful or redirect response. */
    private async request(url: string, init: RequestInit): Promise<Response> {
        const label = `${init.method ?? "GET"} ${url}`;
        for (let attempt = 0; ; attempt += 1) {
            const response = await this.unanswered(label, () => this.send(url, init));
            if (response.ok || REDIRECT_STATUSES.has(response.status)) return response;
            await response.body?.cancel();
            if (!this.shouldRetry(response.status, attempt)) throw new HttpStatusError(`${label} failed with HTTP ${response.status}`, response.status);
            await this.deps.clock.sleep(this.backoffMs(response, attempt));
        }
    }

    /** Runs an operation, tagging any error it throws with the method and URL for easier diagnosis. */
    private async withUrl<T>(label: string, operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw new Error(`${label} failed: ${describeError(error)}`, { cause: error });
        }
    }

    /** Sends a request, reporting a request that got no answer as a network failure tagged with its method and URL. */
    private async unanswered<T>(label: string, operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            throw new NetworkError(`${label} failed: ${describeError(error)}`, { cause: error });
        }
    }

    /** Sends the GET request through the per-host rate limiter so requests to one host stay spaced out. */
    private send(url: string, init: RequestInit): Promise<Response> {
        return this.limiter.schedule(new URL(url).host, () => this.fetchWithTimeout(url, init));
    }

    /** Performs the fetch with an abort timeout from the configured request timeout. */
    private fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
        const signal = AbortSignal.timeout(this.deps.config.timeout_s * MS_PER_SECOND);
        return this.deps.fetchFn(url, { ...init, signal });
    }

    /** Reports whether a failed response is worth retrying, given its status and the retries used so far. */
    private shouldRetry(status: number, attempt: number): boolean {
        return RETRYABLE_STATUSES.has(status) && attempt < this.deps.config.max_retries;
    }

    /** Computes how long to wait before retrying, honoring Retry-After and capping the backoff. */
    private backoffMs(response: Response, attempt: number): number {
        const capMs = this.deps.config.max_retry_after_s * MS_PER_SECOND;
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        if (retryAfterSeconds > 0) return Math.min(retryAfterSeconds * MS_PER_SECOND, capMs);
        return Math.min(BASE_BACKOFF_MS * 2 ** attempt + this.deps.random() * JITTER_MS, capMs);
    }
}

/** Tells whether a content-type header names an HTML document. */
function isHtml(contentType: string | null): boolean {
    const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    return HTML_TYPES.includes(type);
}

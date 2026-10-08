import type { FileConfig } from "../config/schema.js";
import { describeError } from "../errors.js";
import type { Clock } from "./clock.js";
import { HostLimiter } from "./limiter.js";

const MS_PER_SECOND = 1000;
const BASE_BACKOFF_MS = 1000;
const JITTER_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export interface JsonGetter {
  getJson(url: string, headers?: Record<string, string>): Promise<unknown>;
}

interface HttpDeps {
  config: FileConfig["http"];
  clock: Clock;
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  random: () => number;
}

export class HttpClient implements JsonGetter {
  private readonly limiter: HostLimiter;

  /** Builds the HTTP client, wiring up its per-host rate limiter from the given config and clock. */
  constructor(private readonly deps: HttpDeps) {
    this.limiter = new HostLimiter(deps.config, deps.clock);
  }

  /** Fetches a URL as JSON, retrying on transient failures and rate limits per the configured policy. */
  async getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.withUrl(url, () => this.send(url, headers));
      if (response.ok) return this.withUrl(url, () => response.json());
      await response.body?.cancel();
      if (!this.shouldRetry(response.status, attempt)) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
      await this.deps.clock.sleep(this.backoffMs(response, attempt));
    }
  }

  /** Runs an operation, tagging any error it throws with the URL for easier diagnosis. */
  private async withUrl<T>(url: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new Error(`GET ${url} failed: ${describeError(error)}`, { cause: error });
    }
  }

  /** Sends the GET request through the per-host rate limiter so requests to one host stay spaced out. */
  private send(url: string, headers: Record<string, string>): Promise<Response> {
    return this.limiter.schedule(new URL(url).host, () => this.fetchWithTimeout(url, headers));
  }

  /** Performs the fetch with an abort timeout from the configured request timeout. */
  private fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
    const signal = AbortSignal.timeout(this.deps.config.timeout_s * MS_PER_SECOND);
    return this.deps.fetchFn(url, { signal, headers });
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

import type { Settings } from "../config/schema.js";
import type { TextPage } from "../http/client.js";
import type { BrowserPort } from "./browser.js";
import { assertPublic, FetchRefused, type HostLookup } from "./fetchPage.js";
import { renderPage } from "./render.js";

interface RendererDeps {
    connect: (() => Promise<BrowserPort>) | null;
    settings: Pick<Settings["careers_lookup"], "render_seconds" | "max_download_kb">;
    lookup: HostLookup;
    checkLan: (port: BrowserPort) => Promise<string | null>;
    now: () => Date;
}

type Rendered = { page: TextPage } | { fallback: "render_off" | "render_failed" };

const NOT_CONFIGURED = "page rendering not configured";
const TURNED_OFF = "page rendering turned off: browser service failed";
const BYTES_PER_KB = 1024;

export class PageRenderer {
    private port: Promise<BrowserPort> | null = null;
    private off: string | null;
    private checked = false;
    private readonly said = new Set<string>();

    /** Starts the run's renderer: off when no browser service is configured, otherwise connecting on first use. */
    constructor(private readonly deps: RendererDeps) {
        this.off = deps.connect === null ? NOT_CONFIGURED : null;
    }

    /** Renders a page in the browser service, or says why it wasn't: rendering is off, or the service just failed and is now off. */
    async render(url: string): Promise<Rendered> {
        if (this.off !== null) return this.skipped();
        try {
            const port = await this.connected();
            await this.checkLan(port);
            return { page: await renderPage(port, { url, check: (address) => assertPublic(this.deps.lookup, address), seconds: this.deps.settings.render_seconds, maxBytes: this.deps.settings.max_download_kb * BYTES_PER_KB, clock: () => this.deps.now().getTime() }) };
        } catch (error) {
            if (error instanceof FetchRefused) throw error;
            this.off = TURNED_OFF;
            this.said.add(TURNED_OFF);
            return { fallback: "render_failed" };
        }
    }

    /** Lists what the run's summary should say about rendering. */
    notes(): string[] {
        return [...this.said];
    }

    /** Closes the browser connection, if one was opened. */
    async close(): Promise<void> {
        const port = await this.port?.catch(() => null);
        await port?.close();
    }

    /** Reports that rendering is off, noting it for the summary. */
    private skipped(): Rendered {
        if (this.off === NOT_CONFIGURED) this.said.add(NOT_CONFIGURED);
        return { fallback: "render_off" };
    }

    /** Connects to the browser service once per run. */
    private connected(): Promise<BrowserPort> {
        this.port ??= this.deps.connect?.() ?? Promise.reject(new Error(NOT_CONFIGURED));
        return this.port;
    }

    /** Checks once per run whether the browser can reach the LAN, warning without blocking when it can, and keeps any note for the summary. */
    private async checkLan(port: BrowserPort): Promise<void> {
        if (this.checked) return;
        this.checked = true;
        const note = await this.deps.checkLan(port);
        if (note !== null) this.said.add(note);
    }
}

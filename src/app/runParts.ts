import { connectBrowser, type BrowserPort } from "../careers/browser.js";
import { systemLookup, type HostLookup } from "../careers/fetchPage.js";
import { PageRenderer } from "../careers/renderState.js";
import type { AppConfig } from "../config/load.js";
import type { Stores } from "../db/store.js";
import { systemClock } from "../http/clock.js";
import { HttpClient, type JsonGetter, type JsonPoster } from "../http/client.js";
import type { RunLogs } from "./runLogs.js";

export interface RunClients {
    client: HttpClient;
    boards: JsonGetter & JsonPoster;
    lookup: HostLookup;
}

/** Creates the run's HTTP clients, one following redirects and one for job boards that doesn't, with the address lookup they're checked against. */
export function runClients(config: AppConfig, seams: { lookup?: HostLookup }): RunClients {
    const client = new HttpClient({ config: config.settings.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random });
    return { client, boards: client.withoutRedirects(), lookup: seams.lookup ?? systemLookup };
}

/** Creates the run's page renderer, connected to the browser service only when one is configured. */
export function pageRenderer(config: AppConfig, seams: { browser?: (url: string) => Promise<BrowserPort> }, { logs, stores }: { logs: RunLogs; stores: Stores }): PageRenderer {
    const url = config.env.MYJOBBOT_BROWSER_URL;
    const connect = url === undefined ? null : () => (seams.browser ?? connectBrowser)(url);
    return new PageRenderer({ connect, settings: config.settings.careers_lookup, lookup: systemLookup, careers: stores.careers, trace: logs.trace, runId: logs.runId, now: () => new Date() });
}

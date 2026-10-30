import { systemLookup } from "../../src/careers/fetchPage.js";
import { systemClock } from "../../src/http/clock.js";
import { HttpClient } from "../../src/http/client.js";
import { sourceHttp } from "../../src/sources/sourceHttp.js";
import type { SaveSourceDeps } from "../../src/web/saveSource.js";
import { getStores, metNeeds, sourceConfig } from "./uiState.js";

/** Gives saving a source what it needs: the owner's sources, what the rules check against, and a test fetch through the same network-checked client a run uses. */
export async function sourceDeps(): Promise<SaveSourceDeps> {
    const { stores } = await getStores();
    const { http, jsearch } = sourceConfig();
    const client = new HttpClient({ config: http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random }).withoutRedirects();
    const apiKey = process.env.JSEARCH_API_KEY ?? "";
    const access = { http: sourceHttp({ http: client, lookup: systemLookup }), ...(apiKey === "" ? {} : { jsearch: { apiKey, settings: jsearch } }) };
    return { store: stores.sources, facts: { limits: jsearch, met: await metNeeds(stores) }, test: { access, apiCalls: stores.apiCalls }, now: () => new Date() };
}

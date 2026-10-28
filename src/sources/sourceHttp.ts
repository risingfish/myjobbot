import { assertPublic, type HostLookup } from "../careers/fetchPage.js";
import type { SourceHttp } from "./module.js";

interface SourceHttpDeps {
    http: SourceHttp;
    lookup: HostLookup;
}

/** Wraps a client so every request a source makes passes the same public-address check as a page download. */
export function sourceHttp(deps: SourceHttpDeps): SourceHttp {
    return {
        getJson: async (url, headers) => {
            await assertPublic(deps.lookup, url);
            return deps.http.getJson(url, headers);
        },
        postJson: async (url, body) => {
            await assertPublic(deps.lookup, url);
            return deps.http.postJson(url, body);
        },
    };
}

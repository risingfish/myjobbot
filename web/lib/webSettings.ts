import { cookieOptions, type CookieSpec } from "../../src/web/security/cookies.js";
import { parseBaseUrl } from "../../src/web/security/baseUrl.js";
import { loadRepoEnv } from "./env.js";

export interface WebSettings {
    url: URL;
    trustedProxies: number;
    cookies: { session: CookieSpec; csrf: CookieSpec };
}

/** Returns the UI's public address, trusted proxies and cookie settings, or null when the address is missing or unsafe. */
export function webSettings(): WebSettings | null {
    loadRepoEnv();
    const base = parseBaseUrl(process.env);
    return base.ok ? { url: base.url, trustedProxies: base.trustedProxies, cookies: cookieOptions(base.url) } : null;
}

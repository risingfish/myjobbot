import { randomBytes } from "node:crypto";
import type { AuthContext } from "../../src/accounts/flows/context.js";
import { cookieOptions, type CookieSpec } from "../../src/web/security/cookies.js";
import { parseBaseUrl } from "../../src/web/security/baseUrl.js";
import { openedStores } from "./database.js";
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

/** Returns what the account flows run against: the stores, the clock and a secure random source. */
export async function authContext(): Promise<AuthContext> {
    return { stores: await openedStores(), now: () => new Date().toISOString(), random: randomBytes };
}

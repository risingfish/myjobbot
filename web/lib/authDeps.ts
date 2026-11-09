import { randomBytes } from "node:crypto";
import type { AuthContext, MailSlot } from "../../src/accounts/flows/context.js";
import { secretKeyStatus } from "../../src/secrets/secretKey.js";
import { mailSlot } from "../../src/mail/fromEnv.js";
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

const cache = globalThis as typeof globalThis & { __myjobbotMail?: MailSlot | null };

/** Returns the account mailer, built once per process from the mail settings and the public address. */
function mail(): MailSlot | null {
    if (cache.__myjobbotMail === undefined) cache.__myjobbotMail = mailSlot(process.env, webSettings()?.url.origin ?? null);
    return cache.__myjobbotMail;
}

/** Returns what the account flows run against: the stores, the clock, a secure random source, the mailer, the key that seals authenticator secrets and this site as hardware keys know it. */
export async function authContext(): Promise<AuthContext> {
    const stores = await openedStores();
    const key = secretKeyStatus(process.env);
    const url = webSettings()?.url;
    const relyingParty = url === undefined ? null : { id: url.hostname, origin: url.origin };
    return { stores, now: () => new Date().toISOString(), random: randomBytes, mail: mail(), secretKey: key.status === "ok" ? key.key : null, relyingParty };
}

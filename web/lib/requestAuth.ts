import { cookies, headers } from "next/headers.js";
import type { SessionCookies } from "../../src/accounts/flows/signIn.js";
import { tokenDigest } from "../../src/accounts/tokens.js";
import { clientAddress } from "../../src/web/security/clientAddress.js";
import type { WebSettings } from "./authDeps.js";

/** Returns the key this request's client is counted by, through the trusted proxies only. */
export async function requestAddress(settings: WebSettings): Promise<string> {
    return clientAddress((await headers()).get("x-forwarded-for"), settings.trustedProxies);
}

/** Returns the digest of the sign-in cookie the browser holds, or null. */
export async function heldDigest(settings: WebSettings): Promise<string | null> {
    const value = (await cookies()).get(settings.cookies.session.name)?.value;
    return value === undefined ? null : tokenDigest(value);
}

/** Gives the browser a new sign-in's cookies. */
export async function setSessionCookies(settings: WebSettings, issued: SessionCookies): Promise<void> {
    const jar = await cookies();
    jar.set(settings.cookies.session.name, issued.session, settings.cookies.session.options);
    jar.set(settings.cookies.csrf.name, issued.csrf, settings.cookies.csrf.options);
}

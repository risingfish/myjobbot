import { cookies, headers } from "next/headers.js";
import type { SessionCookies } from "../../src/accounts/flows/sessions.js";
import { tokenDigest } from "../../src/accounts/tokens.js";
import { locationLabel, osFrom, roundedPosition } from "../../src/accounts/device.js";
import { lookUpPlace } from "../../src/accounts/geo.js";
import type { Device } from "../../src/db/sessionStore.js";
import { clientAddress, displayIp } from "../../src/web/security/clientAddress.js";
import type { WebSettings } from "./webSettings.js";

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

/** Returns the device a sign-in comes from: its IP address, its operating system, and where it is, from the shared position or the IP. */
export async function requestDevice(settings: WebSettings, form: FormData): Promise<Device> {
    const incoming = await headers();
    const ip = displayIp(incoming.get("x-forwarded-for"), settings.trustedProxies);
    const position = roundedPosition(form.get("lat") as string | null, form.get("lng") as string | null);
    return { ip, os: osFrom(incoming.get("sec-ch-ua-platform"), incoming.get("user-agent")), location: locationLabel({ position, ip }, lookUpPlace) };
}

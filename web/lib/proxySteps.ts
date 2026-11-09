import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server.js";
import { MESSAGES } from "../../src/accounts/messages.js";
import { newToken, tokenDigest } from "../../src/accounts/tokens.js";
import type { Session } from "../../src/db/sessionStore.js";
import type { CsrfDecision } from "../../src/web/security/csrf.js";
import type { GateDecision, GateRequest } from "../../src/web/security/gate.js";
import type { WebSettings } from "./webSettings.js";
import { openedStores } from "./database.js";

const logged = globalThis as typeof globalThis & { __myjobbotBaseUrlLogged?: boolean };

/** Reads the parts of a request the gate decides on. */
export function gateRequest(request: NextRequest): GateRequest {
    const { pathname, search } = request.nextUrl;
    return { method: request.method, pathname, search, origin: request.headers.get("origin"), fetchSite: request.headers.get("sec-fetch-site"), isAction: request.headers.has("next-action") };
}

/** Answers every request with the fixed message when the public address is missing or unsafe, logging it once. */
export function baseUrlMissing(): NextResponse {
    if (!logged.__myjobbotBaseUrlLogged) console.error(MESSAGES.base_url);
    logged.__myjobbotBaseUrlLogged = true;
    return new NextResponse(MESSAGES.base_url, { status: 500 });
}

/** Finds the sign-in a browser's cookie names, looking nothing up when there is no cookie. */
export async function lookUpSession(cookie: string | undefined, now: string): Promise<Session | null> {
    if (cookie === undefined) return null;
    return (await openedStores()).sessions.find(tokenDigest(cookie), now);
}

/** Builds the answer for a gate decision that stops a request: a redirect with an empty body, or a fixed refusal. */
export function stopped(decision: Exclude<GateDecision, { kind: "pass" }>, base: URL): NextResponse {
    if (decision.kind === "redirect") return new NextResponse(null, { status: 303, headers: { Location: new URL(decision.location, base).toString() } });
    return decision.kind === "unauthorized" ? new NextResponse("Signed out", { status: 401 }) : new NextResponse("Forbidden", { status: 403 });
}

/** Marks a sign-in as just used when the gate says it is due. */
export async function touchIfDue(session: Session | null, decision: GateDecision, now: string): Promise<void> {
    if (session !== null && decision.kind === "pass" && decision.touch) await (await openedStores()).sessions.touch(session.idDigest, now);
}

/** Gives the browser a new forgery cookie when it has none that fits, tying it to the sign-in when there is one. */
export async function renewCsrf(response: NextResponse, input: { decision: CsrfDecision; session: Session | null; settings: WebSettings }): Promise<void> {
    if (input.decision !== "issue" && input.decision !== "rebind") return;
    const value = newToken(randomBytes);
    if (input.decision === "rebind" && input.session !== null) await (await openedStores()).sessions.rebindCsrf(input.session.idDigest, tokenDigest(value));
    response.cookies.set(input.settings.cookies.csrf.name, value, input.settings.cookies.csrf.options);
}

/** Puts the security headers, and when asked the no-store rule, on an answer. */
export function withHeaders(response: NextResponse, headers: Record<string, string>, noStore: boolean): NextResponse {
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    if (noStore) response.headers.set("Cache-Control", "private, no-store");
    return response;
}

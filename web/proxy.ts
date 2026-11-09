import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server.js";
import { allowedHosts } from "../src/web/security/baseUrl.js";
import { csrfDecision } from "../src/web/security/csrf.js";
import { gateDecision, originDecision, skipsGate } from "../src/web/security/gate.js";
import { contentSecurityPolicy, forwardedHeaders, securityHeaders } from "../src/web/security/headers.js";
import { webSettings, type WebSettings } from "./lib/webSettings.js";
import { loadRepoEnv } from "./lib/env.js";
import { baseUrlMissing, gateRequest, lookUpSession, renewCsrf, stopped, touchIfDue, withHeaders } from "./lib/proxySteps.js";

/** Says whether a request's Host header names this UI, so other hostnames that resolve here are refused. */
function hostAllowed(request: NextRequest): boolean {
    const host = request.headers.get("host")?.toLowerCase();
    return host !== undefined && allowedHosts(process.env).includes(host);
}

/** Checks one request against the gate: its origin, its forgery cookie and its sign-in, and passes it on with the security headers. */
async function gated(request: NextRequest, settings: WebSettings): Promise<NextResponse> {
    const now = new Date().toISOString();
    const input = gateRequest(request);
    const nonce = randomBytes(16).toString("base64");
    const dev = process.env.NODE_ENV !== "production";
    const headers = securityHeaders(nonce, { https: settings.url.protocol === "https:", dev, path: input.pathname });
    const forbidden = originDecision(input, settings.url.origin);
    if (forbidden !== null) return withHeaders(stopped(forbidden, settings.url), headers, true);
    const session = await lookUpSession(request.cookies.get(settings.cookies.session.name)?.value, now);
    const csrf = csrfDecision({ method: input.method, cookie: request.cookies.get(settings.cookies.csrf.name)?.value ?? null, session });
    if (csrf === "refuse") return withHeaders(stopped({ kind: "forbidden" }, settings.url), headers, true);
    const decision = gateDecision(input, session, now);
    if (decision.kind !== "pass") return withHeaders(stopped(decision, settings.url), headers, true);
    await touchIfDue(session, decision, now);
    const response = NextResponse.next({ request: { headers: forwardedHeaders(request.headers, contentSecurityPolicy(nonce, dev)) } });
    await renewCsrf(response, { decision: csrf, session, settings });
    return withHeaders(response, headers, decision.noStore);
}

/** Lets a request through only for this UI's hosts and, past the public pages and static files, only with a valid sign-in. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
    loadRepoEnv();
    if (!hostAllowed(request)) return new NextResponse("Misdirected Request", { status: 421 });
    const settings = webSettings();
    if (settings === null) return baseUrlMissing();
    if (skipsGate(gateRequest(request))) return NextResponse.next();
    return gated(request, settings);
}

export const config = { matcher: "/:path*" };

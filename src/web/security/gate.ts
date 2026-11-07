import { checkOrigin, isRead } from "./origin.js";

export interface GateRequest {
    method: string;
    pathname: string;
    search: string;
    origin: string | null;
    fetchSite: string | null;
    isAction: boolean;
}

export type GateDecision = { kind: "pass"; touch: boolean; noStore: boolean } | { kind: "redirect"; location: string } | { kind: "unauthorized" } | { kind: "forbidden" };

const PUBLIC_PAGES = new Set(["/sign-in", "/create-account", "/link"]);
const TOUCH_AFTER_MS = 60 * 1000;

/** Says whether a request is for a built static file, which needs no sign-in, cookie or lookup at all. */
export function skipsGate(request: GateRequest): boolean {
    return isRead(request.method) && request.pathname.startsWith("/_next/static/");
}

/** Refuses a change sent from anywhere but the UI's own origin, before any sign-in is looked up. */
export function originDecision(request: GateRequest, baseOrigin: string): { kind: "forbidden" } | null {
    return checkOrigin(request, baseOrigin) ? null : { kind: "forbidden" };
}

/** Says whether a request may go on without a sign-in: the public pages, the browser's icon and the dev server's own reads. */
function isPublic(request: GateRequest): boolean {
    const openRead = request.pathname.startsWith("/_next/") || request.pathname === "/favicon.ico";
    return PUBLIC_PAGES.has(request.pathname) || (isRead(request.method) && openRead);
}

/** Returns the sign-in page's address, returning to the page asked for without the router's own parameter. */
function signInLocation(request: GateRequest): string {
    const search = new URLSearchParams(request.search);
    search.delete("_rsc");
    const query = search.toString();
    const next = `${request.pathname}${query === "" ? "" : `?${query}`}`;
    return next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}

/** Decides what happens to a request once its origin is checked: passed on, sent to sign in, or refused. */
export function gateDecision(request: GateRequest, session: { lastUsedAt: string } | null, now: string): GateDecision {
    const open = isPublic(request);
    const noStore = request.isAction || !open;
    if (session !== null) return { kind: "pass", touch: Date.parse(now) - Date.parse(session.lastUsedAt) > TOUCH_AFTER_MS, noStore };
    if (open || request.isAction) return { kind: "pass", touch: false, noStore };
    return request.pathname.startsWith("/api/") ? { kind: "unauthorized" } : { kind: "redirect", location: signInLocation(request) };
}

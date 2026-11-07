import { expect, test } from "vitest";
import { gateDecision, originDecision, skipsGate, type GateRequest } from "../src/web/security/gate.js";

const BASE = "http://localhost:8080";
const NOW = "2026-11-06T10:00:00.000Z";
const FRESH = { lastUsedAt: "2026-11-06T09:59:30.000Z" };
const STALE = { lastUsedAt: "2026-11-06T09:58:00.000Z" };

function request(path: string, extra: Partial<GateRequest> = {}): GateRequest {
    const url = new URL(path, BASE);
    return { method: "GET", pathname: url.pathname, search: url.search, origin: null, fetchSite: null, isAction: false, ...extra };
}

test("a change from another origin is refused before any sign-in is looked up", () => {
    expect(originDecision(request("/jobs", { method: "POST", origin: "http://evil.test" }), BASE)).toEqual({ kind: "forbidden" });
    expect(originDecision(request("/jobs", { method: "POST", origin: BASE }), BASE)).toBeNull();
    expect(originDecision(request("/jobs"), BASE)).toBeNull();
});

test("the public pages, the browser's icon and the dev server's own requests pass without a sign-in, and static files skip the gate entirely", () => {
    for (const path of ["/sign-in", "/create-account", "/link", "/sign-in?next=%2Fjobs"]) expect(gateDecision(request(path), null, NOW)).toEqual({ kind: "pass", touch: false, noStore: false });
    for (const method of ["GET", "HEAD"]) expect(gateDecision(request("/_next/webpack-hmr", { method }), null, NOW)).toMatchObject({ kind: "pass" });
    expect(gateDecision(request("/favicon.ico"), null, NOW)).toEqual({ kind: "pass", touch: false, noStore: false });
    expect([skipsGate(request("/_next/static/x.js")), skipsGate(request("/_next/static/x.js", { method: "HEAD" }))]).toEqual([true, true]);
    expect([skipsGate(request("/_next/webpack-hmr")), skipsGate(request("/_next/static/x.js", { method: "POST" })), skipsGate(request("/jobs"))]).toEqual([false, false, false]);
});

test("a page asked for without a sign-in is sent to the sign-in page, which returns to it, without the router's own parameter", () => {
    expect(gateDecision(request("/recommended"), null, NOW)).toEqual({ kind: "redirect", location: "/sign-in?next=%2Frecommended" });
    expect(gateDecision(request("/jobs?_rsc=abc"), null, NOW)).toEqual({ kind: "redirect", location: "/sign-in?next=%2Fjobs" });
    expect(gateDecision(request("/jobs?job=x&_rsc=abc"), null, NOW)).toEqual({ kind: "redirect", location: "/sign-in?next=%2Fjobs%3Fjob%3Dx" });
    expect(gateDecision(request("/"), null, NOW)).toEqual({ kind: "redirect", location: "/sign-in" });
});

test("data asked for without a sign-in is refused", () => {
    expect(gateDecision(request("/api/rescores/1"), null, NOW)).toEqual({ kind: "unauthorized" });
    expect(gateDecision(request("/api/rescores/1", { method: "HEAD" }), null, NOW)).toEqual({ kind: "unauthorized" });
});

test("a server action passes the gate on any page with or without a sign-in, leaving the decision to its guard", () => {
    for (const path of ["/sign-in", "/jobs"]) expect(gateDecision(request(path, { method: "POST", isAction: true }), null, NOW)).toEqual({ kind: "pass", touch: false, noStore: true });
});

test("a valid sign-in passes, marked as used only when its last use is over a minute old", () => {
    expect(gateDecision(request("/jobs"), FRESH, NOW)).toEqual({ kind: "pass", touch: false, noStore: true });
    expect(gateDecision(request("/jobs"), STALE, NOW)).toEqual({ kind: "pass", touch: true, noStore: true });
});

test("signed out, in-page navigation and prefetches are redirected like a page, and signed-in answers are never stored", () => {
    expect(gateDecision(request("/jobs", { isAction: false }), null, NOW)).toEqual({ kind: "redirect", location: "/sign-in?next=%2Fjobs" });
    expect(gateDecision(request("/api/rescores/1"), FRESH, NOW)).toEqual({ kind: "pass", touch: false, noStore: true });
    expect(gateDecision(request("/link"), FRESH, NOW)).toEqual({ kind: "pass", touch: false, noStore: false });
});

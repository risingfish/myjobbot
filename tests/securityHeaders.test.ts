import { expect, test } from "vitest";
import { forwardedHeaders, securityHeaders } from "../src/web/security/headers.js";

const PROD = "default-src 'self'; script-src 'self' 'nonce-n1' 'strict-dynamic'; style-src 'self' 'nonce-n1'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

test("every answer carries a strict content policy with the request's nonce", () => {
    expect(securityHeaders("n1", { https: true, dev: false, path: "/jobs" })["Content-Security-Policy"]).toBe(PROD);
});

test("in development only, scripts may use eval and styles may be inline, for the dev server's tools", () => {
    const csp = securityHeaders("n1", { https: false, dev: true, path: "/jobs" })["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self' 'nonce-n1' 'strict-dynamic' 'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
});

test("answers refuse framing and content sniffing, keep referrers on the UI, and over HTTPS only demand HTTPS", () => {
    const https = securityHeaders("n1", { https: true, dev: false, path: "/jobs" });
    expect(https).toMatchObject({ "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "Cross-Origin-Opener-Policy": "same-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Strict-Transport-Security": "max-age=31536000" });
    expect(securityHeaders("n1", { https: false, dev: false, path: "/jobs" })).not.toHaveProperty("Strict-Transport-Security");
});

test("the page an emailed link lands on sends no referrer and is never stored", () => {
    expect(securityHeaders("n1", { https: true, dev: false, path: "/link" })).toMatchObject({ "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" });
    expect(securityHeaders("n1", { https: true, dev: false, path: "/sign-in" })).not.toHaveProperty("Cache-Control");
});

test("the request passed on to the app carries the same content policy, so the app can stamp its scripts with the nonce", () => {
    const forwarded = forwardedHeaders(new Headers({ cookie: "a=b", "content-security-policy": "forged" }), PROD);
    expect([forwarded.get("content-security-policy"), forwarded.get("cookie")]).toEqual([PROD, "a=b"]);
});

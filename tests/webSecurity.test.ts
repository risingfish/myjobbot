import { expect, test } from "vitest";
import { MESSAGES } from "../src/accounts/messages.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { parseBaseUrl } from "../src/web/security/baseUrl.js";
import { clientAddress } from "../src/web/security/clientAddress.js";
import { cookieOptions } from "../src/web/security/cookies.js";
import { csrfDecision } from "../src/web/security/csrf.js";
import { checkOrigin } from "../src/web/security/origin.js";

const BASE = "http://localhost:8080";

test("a change is let through only from the UI's own origin, and reading always is", () => {
    expect(checkOrigin({ method: "POST", origin: BASE, fetchSite: "same-origin" }, BASE)).toBe(true);
    expect(checkOrigin({ method: "POST", origin: BASE, fetchSite: null }, BASE)).toBe(true);
    expect(checkOrigin({ method: "POST", origin: "http://evil.test", fetchSite: null }, BASE)).toBe(false);
    expect(checkOrigin({ method: "POST", origin: null, fetchSite: null }, BASE)).toBe(false);
    expect(checkOrigin({ method: "POST", origin: BASE, fetchSite: "cross-site" }, BASE)).toBe(false);
    expect([checkOrigin({ method: "GET", origin: "http://evil.test", fetchSite: "cross-site" }, BASE), checkOrigin({ method: "HEAD", origin: null, fetchSite: null }, BASE)]).toEqual([true, true]);
});

test("a change needs the forgery cookie, matching the sign-in's when there is one", () => {
    const session = { csrfDigest: tokenDigest("good") };
    expect(csrfDecision({ method: "POST", cookie: null, session: null })).toBe("refuse");
    expect(csrfDecision({ method: "POST", cookie: "bad", session })).toBe("refuse");
    expect(csrfDecision({ method: "POST", cookie: "good", session })).toBe("pass");
    expect(csrfDecision({ method: "POST", cookie: "any", session: null })).toBe("pass");
});

test("a page load without the forgery cookie gets a new one, tied again to the sign-in when there is one", () => {
    const session = { csrfDigest: tokenDigest("good") };
    expect(csrfDecision({ method: "GET", cookie: null, session: null })).toBe("issue");
    expect(csrfDecision({ method: "GET", cookie: null, session })).toBe("rebind");
    expect(csrfDecision({ method: "GET", cookie: "stale", session })).toBe("rebind");
    expect(csrfDecision({ method: "GET", cookie: "good", session })).toBe("pass");
    expect(csrfDecision({ method: "GET", cookie: "any", session: null })).toBe("pass");
});

test("over HTTPS both cookies are host-only, secure and unreadable by scripts; on localhost over HTTP they drop the prefix and Secure", () => {
    expect(cookieOptions(new URL("https://jobs.example.com"))).toEqual({
        session: { name: "__Host-myjobbot_session", options: { httpOnly: true, secure: true, path: "/", sameSite: "lax" } },
        csrf: { name: "__Host-myjobbot_csrf", options: { httpOnly: true, secure: true, path: "/", sameSite: "strict" } },
    });
    expect(cookieOptions(new URL(BASE))).toEqual({
        session: { name: "myjobbot_session", options: { httpOnly: true, secure: false, path: "/", sameSite: "lax" } },
        csrf: { name: "myjobbot_csrf", options: { httpOnly: true, secure: false, path: "/", sameSite: "strict" } },
    });
});

test("the public address must be HTTPS or localhost, a bare origin, and one of the UI's hosts", () => {
    expect(parseBaseUrl({ MYJOBBOT_BASE_URL: BASE })).toMatchObject({ ok: true, trustedProxies: 0 });
    expect(parseBaseUrl({ MYJOBBOT_BASE_URL: "https://jobs.example.com", MYJOBBOT_HOSTS: "jobs.example.com", MYJOBBOT_TRUSTED_PROXIES: "1" })).toMatchObject({ ok: true, trustedProxies: 1 });
    const refused = [{}, { MYJOBBOT_BASE_URL: "http://myserver.lan:8080", MYJOBBOT_HOSTS: "myserver.lan:8080" }, { MYJOBBOT_BASE_URL: "https://jobs.example.com" }, { MYJOBBOT_BASE_URL: "http://localhost:8080/app" }, { MYJOBBOT_BASE_URL: "http://localhost:8080/?x=1" }, { MYJOBBOT_BASE_URL: "not a url" }, { MYJOBBOT_BASE_URL: BASE, MYJOBBOT_TRUSTED_PROXIES: "-1" }];
    for (const env of refused) expect(parseBaseUrl(env)).toEqual({ ok: false, message: MESSAGES.base_url });
});

test("with no trusted proxy every client counts as one direct key, whatever it claims to forward", () => {
    expect(clientAddress("203.0.113.9", 0)).toBe("direct");
    expect(clientAddress(null, 0)).toBe("direct");
});

test("behind trusted proxies the client is the entry that many from the right, and an entry that isn't an address is unknown", () => {
    expect(clientAddress("1.1.1.1, 203.0.113.9", 1)).toBe("203.0.113.9");
    expect(clientAddress("1.1.1.1, 203.0.113.9, 10.0.0.2", 2)).toBe("203.0.113.9");
    expect(clientAddress("203.0.113.9", 3)).toBe("203.0.113.9");
    expect(clientAddress("2001:db8::1", 1)).toBe("2001:db8::1");
    expect([clientAddress("x<script>", 1), clientAddress(null, 1), clientAddress("", 1)]).toEqual(["unknown", "unknown", "unknown"]);
});

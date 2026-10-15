import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { authUrlOptions, isFresh, isLoopbackHost, newConnectRequest, redirectUri } from "../src/gmail/connectRequest.js";

test("only localhost and 127.0.0.1 count as loopback hosts", () => {
    expect(["localhost:8080", "127.0.0.1:8080", "LOCALHOST:3000"].map(isLoopbackHost)).toEqual([true, true, true]);
    expect(["192.168.1.20:8080", "localhost.evil.com", "localhost:8080.evil.com", ""].map(isLoopbackHost)).toEqual([false, false, false, false]);
});

test("a connect request has a 43-character state and verifier, and an S256 challenge of the verifier", () => {
    const request = newConnectRequest();
    expect(request.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request.challenge).toBe(createHash("sha256").update(request.verifier).digest("base64url"));
    expect(newConnectRequest().state).not.toBe(request.state);
});

test("Google sends the owner back to the callback on the address Settings was opened with", () => {
    expect(redirectUri("localhost:8080")).toBe("http://localhost:8080/settings/gmail/callback");
});

test("a taken request is accepted for 10 minutes", () => {
    const now = new Date("2026-10-15T12:10:00.000Z");
    expect(isFresh({ sealedVerifier: "v1.x", createdAt: "2026-10-15T12:01:00.000Z" }, now)).toBe(true);
    expect(isFresh({ sealedVerifier: "v1.x", createdAt: "2026-10-15T11:59:59.000Z" }, now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
});

test("the sign-in asks for offline, read-only Gmail access only, with PKCE", () => {
    expect(authUrlOptions({ state: "s", challenge: "c" })).toEqual({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/gmail.readonly"],
        state: "s",
        code_challenge: "c",
        code_challenge_method: "S256",
    });
});

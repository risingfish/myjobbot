import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { openSealed, seal, SealError } from "../src/gmail/seal.js";

const KEY = randomBytes(32);

test("a sealed value opens back to itself, and sealing twice gives different text", () => {
    const sealed = seal("client-secret-1", "client_secret", KEY);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(openSealed(sealed, "client_secret", KEY)).toBe("client-secret-1");
    expect(seal("client-secret-1", "client_secret", KEY)).not.toBe(sealed);
});

test("another key cannot open a sealed value, and the error never repeats it", () => {
    const sealed = seal("client-secret-2", "client_secret", KEY);
    const open = () => openSealed(sealed, "client_secret", randomBytes(32));
    expect(open).toThrow(SealError);
    expect(open).toThrow("key changed or data damaged");
    expect(() => open()).not.toThrow(/client-secret-2/);
});

test("a value sealed for one field cannot be opened as another", () => {
    const sealed = seal("token", "refresh_token", KEY);
    expect(() => openSealed(sealed, "client_secret", KEY)).toThrow(SealError);
});

test("a tampered or unrecognised value is refused", () => {
    const parts = seal("token", "refresh_token", KEY).split(".");
    const tag = Buffer.from(parts[3] ?? "", "base64url");
    tag[0] = (tag[0] ?? 0) ^ 1;
    const tampered = [...parts.slice(0, 3), tag.toString("base64url")].join(".");
    expect(() => openSealed(tampered, "refresh_token", KEY)).toThrow(SealError);
    expect(() => openSealed("v2.a.b.c", "refresh_token", KEY)).toThrow(SealError);
    expect(() => openSealed("plain text", "refresh_token", KEY)).toThrow(SealError);
});

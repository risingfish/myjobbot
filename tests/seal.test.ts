import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { openOrNull, seal } from "../src/gmail/seal.js";

const KEY = randomBytes(32);

test("a sealed value opens back to itself, and sealing twice gives different text", () => {
    const sealed = seal("app-password-1", "app_password", KEY);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("app-password-1");
    expect(openOrNull(sealed, "app_password", KEY)).toBe("app-password-1");
    expect(seal("app-password-1", "app_password", KEY)).not.toBe(sealed);
});

test("another key cannot open a sealed value", () => {
    expect(openOrNull(seal("app-password-2", "app_password", KEY), "app_password", randomBytes(32))).toBeNull();
});

test("a tampered or unrecognised value is refused", () => {
    const parts = seal("app-password-3", "app_password", KEY).split(".");
    const tag = Buffer.from(parts[3] ?? "", "base64url");
    tag[0] = (tag[0] ?? 0) ^ 1;
    expect(openOrNull([...parts.slice(0, 3), tag.toString("base64url")].join("."), "app_password", KEY)).toBeNull();
    expect(openOrNull("v2.a.b.c", "app_password", KEY)).toBeNull();
    expect(openOrNull("plain text", "app_password", KEY)).toBeNull();
});

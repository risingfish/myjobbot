import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { newToken, tokenDigest } from "../src/accounts/tokens.js";

test("a token is 32 random bytes as 43 base64url characters, kept only as its SHA-256", () => {
    const token = newToken((size) => Buffer.alloc(size, 7));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toEqual(Buffer.alloc(32, 7));
    expect(tokenDigest(token)).toBe(createHash("sha256").update(token).digest("hex"));
});

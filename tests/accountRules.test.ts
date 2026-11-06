import { expect, test } from "vitest";
import { checkEmail, normalizeEmail } from "../src/accounts/emails.js";
import { MESSAGES } from "../src/accounts/messages.js";
import { checkPassword } from "../src/accounts/passwordRule.js";
import { safeReturnPath } from "../src/accounts/returnPath.js";

test("an email's key is the address trimmed and lowercased", () => {
    expect(normalizeEmail(" Owner@Example.com ")).toBe("owner@example.com");
});

test("a valid email is kept as typed, trimmed, with its key", () => {
    expect(checkEmail(" Ada@Example.com ")).toEqual({ ok: true, email: "Ada@Example.com", emailKey: "ada@example.com" });
});

test("an email that is too long, holds a line break or control character, or isn't one @ and a dotted domain is refused", () => {
    const refused = [`${"a".repeat(250)}@b.co`, "a@b.co\nBcc: x@y.z", "a\u0007@b.co", "ab.co", "a@@b.co", "a@b@c.co", "a@localhost", "@b.co", "a@", ""];
    for (const email of refused) expect(checkEmail(email)).toEqual({ ok: false, message: MESSAGES.email_invalid });
});

test("a password of 10 to 128 characters with a lowercase letter, an uppercase letter, a digit and a symbol meets the rule", () => {
    expect(checkPassword("Abcdefgh1!")).toBeNull();
    expect(checkPassword(`Aa1!${"x".repeat(124)}`)).toBeNull();
});

test("a password missing any one class, or of 9 or 129 characters, is refused with the rule", () => {
    for (const password of ["abcdefgh1!", "ABCDEFGH1!", "Abcdefghi!", "Abcdefgh12", "Abcdefg1!", `Aa1!${"x".repeat(125)}`]) expect(checkPassword(password)).toBe(MESSAGES.password_rule);
});

test("a return path on the UI itself is kept", () => {
    expect(safeReturnPath("/recommended?x=1")).toBe("/recommended?x=1");
    expect(safeReturnPath("/jobs")).toBe("/jobs");
});

test("anything that could leave the UI, carries control characters, or is over 512 characters returns to the home page", () => {
    for (const next of ["//evil.test", "/\\evil.test", "https://evil.test", "%2F%2Fevil.test", "/%2F%2Fevil.test", "/x%0d%0a", `/${"a".repeat(512)}`, "", null, undefined, "%E0%A4%A"]) expect(safeReturnPath(next)).toBe("/");
});

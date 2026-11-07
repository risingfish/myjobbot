import { expect, test } from "vitest";
import { makeRecoveryCodes, recoveryDigest } from "../src/accounts/tokens.js";
import { randomBytes } from "node:crypto";

test("a set is ten codes of ten characters from 32 symbols with no I, O, 0 or 1, shown in two groups of five", () => {
    const codes = makeRecoveryCodes(randomBytes);
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(codes).size).toBe(10);
});

test("every symbol of the alphabet can appear, so each code holds 50 bits", () => {
    let next = 0;
    const counting = (size: number) => Buffer.from(Array.from({ length: size }, () => next++ % 256));
    const seen = new Set(makeRecoveryCodes(counting).join("").replaceAll("-", ""));
    expect(seen.size).toBe(32);
});

test("a typed code is compared without regard to case, spaces or the dash", () => {
    expect(recoveryDigest(" abcde fghjk ")).toBe(recoveryDigest("ABCDE-FGHJK"));
    expect(recoveryDigest("abcde-fghjk")).toBe(recoveryDigest("ABCDEFGHJK"));
    expect(recoveryDigest("ABCDE-FGHJK")).not.toBe(recoveryDigest("ABCDE-FGHJM"));
});

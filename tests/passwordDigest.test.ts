import { expect, test } from "vitest";
import { digestPassword, standInDigest, verifyPassword } from "../src/accounts/passwordDigest.js";

test("a password digest names argon2id and its settings, with a fresh salt each time", async () => {
    const [first, second] = [await digestPassword("Abcdefgh1!"), await digestPassword("Abcdefgh1!")];
    expect(first).toMatch(/^argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
});

test("a digest accepts only its own password and a damaged digest accepts nothing, without throwing", async () => {
    const digest = await digestPassword("Abcdefgh1!");
    expect(await verifyPassword("Abcdefgh1!", digest)).toBe(true);
    expect(await verifyPassword("Abcdefgh1?", digest)).toBe(false);
    for (const damaged of ["", "argon2id$v=19$m=19456,t=2,p=1$x", digest.replace("argon2id", "argon2i"), digest.replace("m=19456", "m=abc"), digest.slice(0, -2)]) expect(await verifyPassword("Abcdefgh1!", damaged)).toBe(false);
});

test("the stand-in digest checked for an unknown email accepts no password", async () => {
    expect(await verifyPassword("Abcdefgh1!", await standInDigest())).toBe(false);
    expect(await standInDigest()).toBe(await standInDigest());
});

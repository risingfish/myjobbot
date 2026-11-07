import { expect, test } from "vitest";
import { checkCode, newAuthenticator } from "../src/accounts/totp.js";

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("a new authenticator has a 20-byte secret and a setup address naming myjobbot and the account's email", () => {
    const app = newAuthenticator((size) => Buffer.alloc(size, 1), "zac@forthebrew.com");
    expect(app.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(app.secret).toBe("AEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIB");
    expect(app.uri).toBe("otpauth://totp/myjobbot:zac%40forthebrew.com?issuer=myjobbot&secret=AEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIB&algorithm=SHA1&digits=6&period=30");
});

test("a code is accepted for the current 30-second step and one either side, giving its step, and refused beyond", () => {
    const at = (seconds: number) => new Date(seconds * 1000).toISOString();
    expect(checkCode(RFC_SECRET, "287082", at(59))).toBe(1);
    expect(checkCode(RFC_SECRET, "287082", at(89))).toBe(1);
    expect(checkCode(RFC_SECRET, "287082", at(29))).toBe(1);
    expect(checkCode(RFC_SECRET, "287082", at(120))).toBeNull();
    expect(checkCode(RFC_SECRET, "081804", at(1111111109))).toBe(37037036);
    expect([checkCode(RFC_SECRET, "28708", at(59)), checkCode(RFC_SECRET, "abcdef", at(59))]).toEqual([null, null]);
});

test("a later code gives a later step, so a step at or before the last one used can be refused", () => {
    const early = checkCode(RFC_SECRET, "287082", new Date(59 * 1000).toISOString());
    const late = checkCode(RFC_SECRET, "081804", new Date(1111111109 * 1000).toISOString());
    expect(early !== null && late !== null && late > early).toBe(true);
});

import { randomBytes } from "node:crypto";
import { expect, test } from "vitest";
import { secretKeyStatus } from "../src/gmail/secretKey.js";

test("the secret key is missing, invalid without revealing itself, or a 32-byte key", () => {
    expect(secretKeyStatus({})).toEqual({ status: "missing" });
    const short = randomBytes(16).toString("base64");
    const invalid = secretKeyStatus({ MYJOBBOT_SECRET_KEY: short });
    expect(invalid).toEqual({ status: "invalid" });
    expect(JSON.stringify(invalid)).not.toContain(short);
    const key = randomBytes(32);
    expect(secretKeyStatus({ MYJOBBOT_SECRET_KEY: key.toString("base64") })).toEqual({ status: "ok", key });
});

import { Secret, TOTP } from "otpauth";
import type { RandomBytes } from "./tokens.js";

const SECRET_BYTES = 20;
const PERIOD_SECONDS = 30;

/** Returns the authenticator settings every app supports: SHA-1, 6 digits, 30-second steps. */
function totp(secret: Secret, email = ""): TOTP {
    return new TOTP({ issuer: "myjobbot", label: email, algorithm: "SHA1", digits: 6, period: PERIOD_SECONDS, secret });
}

/** Makes a new authenticator secret for an account: its base32 text, shown once for typing, and the address a scanned code holds. */
export function newAuthenticator(random: RandomBytes, email: string): { secret: string; uri: string } {
    const secret = new Secret({ buffer: new Uint8Array(random(SECRET_BYTES)).buffer });
    return { secret: secret.base32, uri: totp(secret, email).toString() };
}

/** Checks a typed code against a secret at a time, giving the 30-second step it belongs to when it is the current step or one either side, else null. */
export function checkCode(secret: string, code: string, now: string): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const timestamp = Date.parse(now);
    const delta = totp(Secret.fromBase32(secret)).validate({ token: code, timestamp, window: 1 });
    return delta === null ? null : Math.floor(timestamp / 1000 / PERIOD_SECONDS) + delta;
}

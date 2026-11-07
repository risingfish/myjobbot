import { createHash } from "node:crypto";

export type RandomBytes = (size: number) => Buffer;

const TOKEN_BYTES = 32;

/** Makes a new one-time value: 32 random bytes as base64url. */
export function newToken(random: RandomBytes): string {
    return random(TOKEN_BYTES).toString("base64url");
}

/** Returns the SHA-256 digest a one-time value is stored and looked up by. */
export function tokenDigest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_LENGTH = 10;
const RECOVERY_COUNT = 10;

/** Makes one recovery code: ten symbols from a 32-symbol alphabet without look-alikes (50 bits), shown in two groups of five. */
function recoveryCode(random: RandomBytes): string {
    const symbols = Array.from(random(RECOVERY_LENGTH), (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
    return `${symbols.slice(0, 5)}-${symbols.slice(5)}`;
}

/** Makes a set of ten one-time recovery codes. */
export function makeRecoveryCodes(random: RandomBytes): string[] {
    return Array.from({ length: RECOVERY_COUNT }, () => recoveryCode(random));
}

/** Returns a typed recovery code as it is compared: upper case, without spaces or the dash. */
function normalizeRecoveryCode(code: string): string {
    return code.toUpperCase().replace(/[\s-]/g, "");
}

/** Returns the digest a recovery code is stored and looked up by. */
export function recoveryDigest(code: string): string {
    return tokenDigest(`recovery:${normalizeRecoveryCode(code)}`);
}

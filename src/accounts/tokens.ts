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

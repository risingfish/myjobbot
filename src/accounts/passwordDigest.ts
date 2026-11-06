import { argon2, randomBytes, timingSafeEqual, type Argon2Parameters } from "node:crypto";

const SETTINGS = { memory: 19456, passes: 2, parallelism: 1 };
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;
const PREFIX = `argon2id$v=19$m=${SETTINGS.memory},t=${SETTINGS.passes},p=${SETTINGS.parallelism}`;

let standIn: Promise<string> | undefined;

/** Runs Argon2id over a password and salt with the stored settings. */
function derive(password: string, salt: Buffer): Promise<Buffer> {
    const parameters: Argon2Parameters = { message: password, nonce: salt, tagLength: TAG_LENGTH, ...SETTINGS };
    return new Promise((resolve, reject) => argon2("argon2id", parameters, (error, key) => (error ? reject(error) : resolve(key))));
}

/** Returns a password's stored digest: the algorithm, its settings, a fresh salt and the tag. */
export async function digestPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const tag = await derive(password, salt);
    return [PREFIX, salt.toString("base64url"), tag.toString("base64url")].join("$");
}

/** Splits a stored digest into its salt and tag, or returns null when it isn't one this module made. */
function parts(digest: string): { salt: Buffer; tag: Buffer } | null {
    if (!digest.startsWith(`${PREFIX}$`)) return null;
    const [salt, tag, ...rest] = digest.slice(PREFIX.length + 1).split("$");
    if (salt === undefined || tag === undefined || rest.length > 0) return null;
    const decoded = { salt: Buffer.from(salt, "base64url"), tag: Buffer.from(tag, "base64url") };
    return decoded.salt.length === SALT_LENGTH && decoded.tag.length === TAG_LENGTH ? decoded : null;
}

/** Says whether a password matches a stored digest, comparing in constant time; a damaged digest matches nothing. */
export async function verifyPassword(password: string, digest: string): Promise<boolean> {
    const stored = parts(digest);
    if (stored === null) return false;
    return timingSafeEqual(await derive(password, stored.salt), stored.tag);
}

/** Returns a digest of a random password, made once, checked when an email has no account so every answer takes as long. */
export function standInDigest(): Promise<string> {
    standIn ??= digestPassword(randomBytes(32).toString("base64url"));
    return standIn;
}

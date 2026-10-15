import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SealedField = "app_password";

const VERSION = "v1";
const CIPHER = "aes-256-gcm";

class SealError extends Error {
    /** Reports that a stored secret could not be opened, without saying anything about its contents. */
    constructor() {
        super("key changed or data damaged");
        this.name = "SealError";
    }
}

/** Encrypts a secret for storage, bound to the field it will be stored in. */
export function seal(value: string, field: SealedField, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(CIPHER, key, iv).setAAD(Buffer.from(field));
    const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [VERSION, ...[iv, body, cipher.getAuthTag()].map((part) => part.toString("base64url"))].join(".");
}

/** Decrypts a stored secret, throwing SealError if the key, the field or the stored text is wrong. */
function openSealed(sealed: string, field: SealedField, key: Buffer): string {
    const [version, iv, body, tag, ...rest] = sealed.split(".");
    if (version !== VERSION || iv === undefined || body === undefined || tag === undefined || rest.length > 0) throw new SealError();
    try {
        const decipher = createDecipheriv(CIPHER, key, Buffer.from(iv, "base64url")).setAAD(Buffer.from(field));
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
    } catch {
        throw new SealError();
    }
}

/** Opens a sealed value, or returns null when the key can no longer open it. */
export function openOrNull(sealed: string, field: SealedField, key: Buffer): string | null {
    try {
        return openSealed(sealed, field, key);
    } catch (error) {
        if (error instanceof SealError) return null;
        throw error;
    }
}

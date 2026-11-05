import { createHash } from "node:crypto";

/** Gives the first 16 hex characters of a text's SHA-256, to name a text by its content. */
export function sha16(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

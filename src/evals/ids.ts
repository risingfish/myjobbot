import { createHash } from "node:crypto";

const PLAIN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/** Names a job's case by its board and id, hashing an id that isn't a plain word so every name is safe as a file name. */
export function caseId(ats: string, jobId: string): string {
    return PLAIN_ID.test(jobId) ? `${ats}-${jobId}` : `${ats}--${hashed(jobId)}`;
}

/** Names a value by its content, so equal values, whatever their key order, share one name. */
export function contentId(value: unknown): string {
    return hashed(JSON.stringify(sorted(value)));
}

/** Gives the first 16 hex characters of a text's SHA-256. */
function hashed(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Copies a value with every object's keys in order, so its JSON text doesn't depend on how it was built. */
function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, inner]) => [key, sorted(inner)]),
    );
}

/** Names a run by when it started, to the second, and four random hex characters, so runs sort by time. */
export function runId(now: Date, random: () => number): string {
    const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
    return `${stamp}-${Math.floor(random() * 0x10000)
        .toString(16)
        .padStart(4, "0")}`;
}

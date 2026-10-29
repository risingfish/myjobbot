import { ZodError } from "zod";
import { FetchRefused } from "../careers/fetchPage.js";
import { HttpStatusError, NetworkError } from "../http/errors.js";

export type FailureReason = "not found" | "refused" | "unreachable" | "unexpected answer" | "not set up";

export class NotSetUp extends Error {
    /** Reports that a source can't be fetched until something it needs is set up. */
    constructor(message: string) {
        super(message);
        this.name = "NotSetUp";
    }
}

/** Names why a source's fetch failed by a fixed reason, looking through the failure and what caused it, and never repeats its message. */
export function failureReason(error: unknown): FailureReason {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
        const reason = reasonOf(current);
        if (reason !== null) return reason;
    }
    return "unexpected answer";
}

/** Names one failure by its kind, or null when its kind says nothing. */
function reasonOf(error: Error): FailureReason | null {
    if (error instanceof NotSetUp) return "not set up";
    if (error instanceof HttpStatusError) return error.status === 404 ? "not found" : error.status === 401 || error.status === 403 ? "refused" : "unexpected answer";
    if (error instanceof NetworkError) return "unreachable";
    if (error instanceof FetchRefused) return "refused";
    return error instanceof ZodError ? "unexpected answer" : null;
}

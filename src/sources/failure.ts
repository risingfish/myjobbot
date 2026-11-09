import { ZodError } from "zod";
import { FetchRefused } from "../careers/fetchPage.js";
import { HttpStatusError, NetworkError } from "../http/errors.js";

export type FailureReason = "not found" | "refused" | "unreachable" | "unexpected answer" | "not set up";

export class SourceFailure extends Error {
    /** Reports that a source's fetch failed for a reason its own code chose from the fixed reasons. */
    constructor(
        readonly reason: FailureReason,
        message: string,
    ) {
        super(message);
        this.name = "SourceFailure";
    }
}

export class NotSetUp extends SourceFailure {
    /** Reports that a source can't be fetched until something it needs is set up. */
    constructor(message: string) {
        super("not set up", message);
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
    if (error instanceof SourceFailure) return error.reason;
    if (error instanceof HttpStatusError) return statusReason(error.status);
    if (error instanceof NetworkError) return "unreachable";
    if (error instanceof FetchRefused) return "refused";
    return error instanceof ZodError ? "unexpected answer" : null;
}

/** Names a failing HTTP status: a missing page, a refused request, or any other answer. */
function statusReason(status: number): FailureReason {
    if (status === 404) return "not found";
    return status === 401 || status === 403 ? "refused" : "unexpected answer";
}

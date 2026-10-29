import { ZodError } from "zod";
import { FetchRefused } from "../careers/fetchPage.js";
import { ALERT_NOTES, AlertsUnavailable } from "../gmail/alertJobs/usable.js";
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
    if (error instanceof HttpStatusError) return statusReason(error.status);
    if (error instanceof NetworkError) return "unreachable";
    if (error instanceof FetchRefused) return "refused";
    if (error instanceof AlertsUnavailable) return alertReason(error.note);
    return error instanceof ZodError ? "unexpected answer" : null;
}

/** Names a failing HTTP status: a missing page, a refused request, or any other answer. */
function statusReason(status: number): FailureReason {
    if (status === 404) return "not found";
    return status === 401 || status === 403 ? "refused" : "unexpected answer";
}

/** Names why Gmail alerts couldn't be read, by its fixed note: Gmail unreachable, a Gmail error, or something to set up again. */
function alertReason(note: string): FailureReason {
    if (note === ALERT_NOTES.unreachable) return "unreachable";
    return note === ALERT_NOTES.error ? "unexpected answer" : "not set up";
}

import { APIError } from "openai";

export type RunFailureReason = "database" | "model" | "timeout" | "browser" | "other";

const BY_NAME = new Map<string, RunFailureReason>([
    ["TimeoutError", "timeout"],
    ["TargetClosedError", "browser"],
]);

/** Gives the fixed reason a run part failed, from the kind of error alone and never its text, so it can be stored and shown. */
export function runFailureReason(error: unknown): RunFailureReason {
    if (error instanceof APIError) return "model";
    if (!(error instanceof Error)) return "other";
    if (typeof (error as { sqlState?: unknown }).sqlState === "string") return "database";
    return BY_NAME.get(error.name) ?? "other";
}

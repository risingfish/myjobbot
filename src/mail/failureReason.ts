export type MailFailureReason = "auth" | "connect" | "tls" | "refused" | "other";

const REASONS = new Map<string, MailFailureReason>([
    ["EAUTH", "auth"],
    ["ECONNECTION", "connect"],
    ["ETIMEDOUT", "connect"],
    ["EDNS", "connect"],
    ["ESOCKET", "connect"],
    ["ETLS", "tls"],
    ["EENVELOPE", "refused"],
    ["EMESSAGE", "refused"],
]);

/** Returns the fixed reason a mail failed, from the error's code alone, never its text. */
export function mailFailureReason(error: unknown): MailFailureReason {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" ? (REASONS.get(code) ?? "other") : "other";
}

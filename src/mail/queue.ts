import type { Mailer, MailMessage } from "./mailer.js";

type FailureReason = "auth" | "connect" | "tls" | "refused" | "other";

const REASONS: Record<string, FailureReason> = { EAUTH: "auth", ECONNECTION: "connect", ETIMEDOUT: "connect", EDNS: "connect", ESOCKET: "connect", ETLS: "tls", EENVELOPE: "refused", EMESSAGE: "refused" };

/** Returns the fixed reason a mail failed, from the error's code alone, never its text. */
function failureReason(error: unknown): FailureReason {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" ? (REASONS[code] ?? "other") : "other";
}

/** Sends a mail without waiting for it, so no answer depends on the mail server; a failure is logged by its fixed reason. */
export function queueMail(mailer: Mailer, message: MailMessage, log: (line: string) => void = console.error): void {
    mailer.send(message).catch((error: unknown) => log(`mail_failed ${failureReason(error)}`));
}

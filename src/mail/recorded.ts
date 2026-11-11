import type { MailLog } from "../db/mailLog.js";
import { mailFailureReason } from "./failureReason.js";
import type { Mailer, MailMessage } from "./mailer.js";

const LOG_FAILED = "mail_log_failed";

/** Wraps a mailer so each send is also recorded in the mail log by its kind and outcome; the send itself, failures included, is unchanged. */
export function recordedMailer(mailer: Mailer, log: MailLog, now: () => Date = () => new Date(), report: (line: string) => void = console.error): Mailer {
    const note = (message: MailMessage, outcome: "sent" | "failed", error?: unknown) =>
        log.record({ at: now().toISOString(), kind: message.kind, outcome, reason: outcome === "failed" ? mailFailureReason(error) : null }).catch(() => report(LOG_FAILED));
    return {
        send: async (message) => {
            try {
                await mailer.send(message);
            } catch (error) {
                await note(message, "failed", error);
                throw error;
            }
            await note(message, "sent");
        },
    };
}

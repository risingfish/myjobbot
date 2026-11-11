import { mailFailureReason as failureReason } from "./failureReason.js";
import type { Mailer, MailMessage } from "./mailer.js";


/** Sends a mail and waits for it, for a process about to end; a failure is logged by its fixed reason and never thrown. */
export async function sendMail(mailer: Mailer, message: MailMessage, log: (line: string) => void = console.error): Promise<void> {
    await mailer.send(message).catch((error: unknown) => log(`mail_failed ${failureReason(error)}`));
}

/** Sends a mail without waiting for it, so no answer depends on the mail server; a failure is logged by its fixed reason. */
export function queueMail(mailer: Mailer, message: MailMessage, log: (line: string) => void = console.error): void {
    mailer.send(message).catch((error: unknown) => log(`mail_failed ${failureReason(error)}`));
}

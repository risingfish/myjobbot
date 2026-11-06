import type { Mailer, MailMessage } from "../../src/mail/mailer.js";

export class MemoryMailer implements Mailer {
    readonly sent: MailMessage[] = [];

    async send(message: MailMessage): Promise<void> {
        this.sent.push(message);
    }
}

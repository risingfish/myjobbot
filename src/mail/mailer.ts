import type { Transporter } from "nodemailer";
import type { MailKind } from "./messages.js";
import type { MailSettings } from "./settings.js";

export interface MailMessage {
    to: string;
    kind: MailKind;
    subject: string;
    text: string;
}

export interface Mailer {
    send(message: MailMessage): Promise<void>;
}

/** Returns nodemailer's transport settings: TLS from the start on port 465, else STARTTLS required. */
export function transportOptions(settings: MailSettings) {
    const implicit = settings.port === 465;
    return { host: settings.host, port: settings.port, secure: implicit, requireTLS: !implicit, auth: { user: settings.user, pass: settings.password } };
}

/** Returns a mailer that sends plain-text mail from the configured sender through an SMTP transport. */
export function smtpMailer(transport: Transporter, from: string): Mailer {
    return { send: async (message) => void (await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text })) };
}

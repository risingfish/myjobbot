import { queueMail } from "../../mail/queue.js";
import type { MailContent } from "../../mail/messages.js";
import type { AuthContext } from "./context.js";

/** Queues a mail to one address when mail is set up, building it from the app's public address; with mail off it does nothing. */
export function mailTo(ctx: AuthContext, to: string, build: (baseUrl: string) => MailContent): void {
    if (ctx.mail === null) return;
    queueMail(ctx.mail.mailer, { to, ...build(ctx.mail.baseUrl) });
}

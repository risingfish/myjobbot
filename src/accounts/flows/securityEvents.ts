import type { SecurityEvent } from "../../db/securityEventLog.js";
import { securityNotice } from "../../mail/messages.js";
import { noticeFor } from "../events.js";
import type { AuthContext } from "./context.js";
import { mailTo } from "./mail.js";

/** Stores a security event and, when it is one the owner is told about, queues the notice to the account's email. */
export async function recordSecurityEvent(ctx: AuthContext, event: SecurityEvent): Promise<void> {
    await ctx.stores.events.record(event);
    const what = noticeFor(event.event);
    if (what === null) return;
    const account = await ctx.stores.accounts.account(event.userId);
    if (account?.email) mailTo(ctx, account.email, (baseUrl) => securityNotice({ name: account.name, what, at: event.at }, baseUrl));
}

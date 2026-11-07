import { signInLink } from "../../mail/messages.js";
import { tokenDigest } from "../tokens.js";
import type { AuthContext } from "../flows/context.js";
import { emailKeyedRequest, EXPIRED, mailLink, type Answer, type LinkSpend, type SpendAnswer } from "../flows/mailLinks.js";
import { recordSecurityEvent } from "../flows/securityEvents.js";
import { startSession } from "../flows/sessions.js";
import { wayUsable } from "./usable.js";

/** Mails a sign-in link to an account with email links on. */
export function requestSignInLink(ctx: AuthContext, input: { email: string; address: string }): Promise<Answer> {
    return emailKeyedRequest(ctx, input.email, async (account) => {
        if (await wayUsable(ctx, account.id, "email_link")) await mailLink(ctx, account, { token: { purpose: "signin" }, build: signInLink });
    });
}

/** Signs in with a sign-in link, once, and only while the account still has email links usable. */
export async function spendSignIn(ctx: AuthContext, spend: LinkSpend): Promise<SpendAnswer> {
    const spent = await ctx.stores.tokens.spendEmailToken({ digest: tokenDigest(spend.token), purpose: "signin" }, ctx.now());
    if (spent === null || !(await wayUsable(ctx, spent.userId, "email_link"))) return EXPIRED;
    const cookies = await startSession(ctx, { userId: spent.userId, address: spend.address, heldDigest: spend.heldDigest, device: spend.device });
    await recordSecurityEvent(ctx, { userId: spent.userId, at: ctx.now(), address: spend.address, event: "signed_in", method: "email_link" });
    return { ok: true, kind: "signin", cookies };
}

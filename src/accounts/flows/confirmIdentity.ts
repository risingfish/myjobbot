import { normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import type { Actor, AuthContext } from "./context.js";
import { passwordMatches, recordFailure, signInLocked } from "./passwordCheck.js";

export interface IdentityProof {
    method: "password";
    password: string;
}

export type Confirmed = { ok: true } | { ok: false; message: string };

/** Renews a sign-in's proof of identity when its holder proves it again; a failure counts toward the sign-in limits. */
export async function confirmIdentity(ctx: AuthContext, actor: Actor, proof: IdentityProof): Promise<Confirmed> {
    const attempt = { emailKey: normalizeEmail(actor.account.email ?? ""), address: actor.address, account: actor.account };
    const locked = await signInLocked(ctx, attempt);
    if (locked || !(await passwordMatches(ctx, actor.account, proof.password))) {
        await recordFailure(ctx, attempt);
        return { ok: false, message: MESSAGES.signin_failed };
    }
    await ctx.stores.sessions.setVerified(actor.session.idDigest, ctx.now());
    return { ok: true };
}

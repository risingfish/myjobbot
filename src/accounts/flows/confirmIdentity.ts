import { MESSAGES } from "../messages.js";
import { appCodeMatches } from "./authenticator.js";
import type { Actor, AuthContext } from "./context.js";
import { keyMatches } from "./keys.js";
import { actorTry, passwordMatches, recordFailure, signInLocked } from "./passwordCheck.js";
import { recoveryCodeMatches } from "./recoveryCodes.js";

export type IdentityProof = { method: "password"; password: string } | { method: "authenticator"; code: string } | { method: "recovery_code"; code: string } | { method: "hardware_key"; response: unknown };

export type Confirmed = { ok: true } | { ok: false; message: string };

/** Says whether a proof of identity is right for the actor's account, by the way it uses. */
function proofMatches(ctx: AuthContext, actor: Actor, proof: IdentityProof): Promise<boolean> {
    if (proof.method === "password") return passwordMatches(ctx, actor.account, proof.password);
    if (proof.method === "authenticator") return appCodeMatches(ctx, actor.account.id, { code: proof.code });
    if (proof.method === "hardware_key") return keyMatches(ctx, actor.account, proof.response);
    return recoveryCodeMatches(ctx, actor.account, { code: proof.code, address: actor.address });
}

/** Renews a sign-in's proof of identity when its holder proves it again by any usable way; a failure counts toward the sign-in limits. */
export async function confirmIdentity(ctx: AuthContext, actor: Actor, proof: IdentityProof): Promise<Confirmed> {
    const attempt = actorTry(actor, proof.method);
    const locked = await signInLocked(ctx, attempt);
    if (locked || !(await proofMatches(ctx, actor, proof))) {
        await recordFailure(ctx, attempt);
        return { ok: false, message: MESSAGES.signin_failed };
    }
    await ctx.stores.sessions.setVerified(actor.session.idDigest, ctx.now());
    return { ok: true };
}

import { MESSAGES } from "../messages.js";
import type { ChoiceKind } from "../ways/catalog.js";
import { PROOF_WAYS, type ProofFields } from "../ways/registry.js";
import { actorTry, recordFailure, signInLocked } from "./attempts.js";
import type { Actor, AuthContext } from "./context.js";

export type IdentityProof = { method: ChoiceKind } & ProofFields;

export type Confirmed = { ok: true } | { ok: false; message: string };

/** Says whether a proof of identity is right for the actor's account, by the way it names. */
async function proofMatches(ctx: AuthContext, actor: Actor, proof: IdentityProof): Promise<boolean> {
    const way = PROOF_WAYS[proof.method];
    const read = way.readProof(proof);
    return read !== null && way.matches(ctx, actor.account, read, actor.address);
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

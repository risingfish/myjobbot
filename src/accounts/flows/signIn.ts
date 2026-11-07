import { normalizeEmail } from "../emails.js";
import { MESSAGES } from "../messages.js";
import type { Account } from "../../db/accountStore.js";
import type { Device } from "../../db/sessionStore.js";
import type { ChoiceKind } from "../ways/catalog.js";
import { PROOF_WAYS, type ProofFields } from "../ways/registry.js";
import type { AuthContext } from "./context.js";
import { recordFailure, signInLocked } from "./attempts.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { startSession, type SessionCookies } from "./sessions.js";

export interface SignInRequest {
    email: string;
    address: string;
    heldDigest: string | null;
    device?: Device;
}

export type SignInAnswer = { ok: true; userId: number; cookies: SessionCookies } | { ok: false; message: string };

const REFUSED: SignInAnswer = { ok: false, message: MESSAGES.signin_failed };

interface SignInWay {
    method: string;
    matches: (account: Account | null) => Promise<boolean>;
}

/** Signs in by one way for an email, under the shared limits, answering every failure with one fixed refusal and recording it against that way. */
async function signInWith(ctx: AuthContext, input: SignInRequest, way: SignInWay): Promise<SignInAnswer> {
    const emailKey = normalizeEmail(input.email);
    const account = await ctx.stores.accounts.byEmailKey(emailKey);
    const attempt = { emailKey, address: input.address, account, method: way.method };
    const locked = await signInLocked(ctx, attempt);
    const matched = !locked && (await way.matches(account));
    if (!matched || account === null) {
        await recordFailure(ctx, attempt);
        return REFUSED;
    }
    const cookies = await startSession(ctx, { userId: account.id, address: input.address, heldDigest: input.heldDigest, device: input.device });
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: input.address, event: "signed_in", method: way.method });
    return { ok: true, userId: account.id, cookies };
}

/** Signs in with an email by the way chosen, reading that way's proof from the fields given; a missing proof is refused like a wrong one. */
export function signInByWay(ctx: AuthContext, input: SignInRequest, chosen: { kind: ChoiceKind; fields: ProofFields }): Promise<SignInAnswer> {
    const way = PROOF_WAYS[chosen.kind];
    const proof = way.readProof(chosen.fields);
    return signInWith(ctx, input, { method: way.kind, matches: async (account) => proof !== null && way.matches(ctx, account, proof, input.address) });
}

/** Ends one sign-in on the server. */
export async function signOut(ctx: AuthContext, sessionDigest: string): Promise<void> {
    await ctx.stores.sessions.end(sessionDigest, ctx.now());
}

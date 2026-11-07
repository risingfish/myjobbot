import type { Account } from "../../db/accountStore.js";
import { makeRecoveryCodes as newCodes, recoveryDigest } from "../tokens.js";
import type { SecurityEventName } from "../events.js";
import type { Actor, AuthContext } from "../flows/context.js";
import { recordSecurityEvent } from "../flows/securityEvents.js";
import type { ProofWay } from "./registry.js";

/** Replaces an account's recovery codes with a new set, kept only as digests, and gives the codes to show once. */
async function issueRecoveryCodes(ctx: AuthContext, userId: number, address: string): Promise<string[]> {
    const codes = newCodes(ctx.random);
    await ctx.stores.tokens.replaceRecoveryCodes(userId, codes.map(recoveryDigest), ctx.now());
    await recordSecurityEvent(ctx, { userId, at: ctx.now(), address, event: "recovery_codes_made", method: null });
    return codes;
}

/** Spends one of an account's recovery codes, recording it, and says whether it was one. */
async function recoveryCodeMatches(ctx: AuthContext, account: Account, input: { code: string; address: string }): Promise<boolean> {
    if (!(await ctx.stores.tokens.spendRecoveryCode(account.id, recoveryDigest(input.code), ctx.now()))) return false;
    await recordSecurityEvent(ctx, { userId: account.id, at: ctx.now(), address: input.address, event: "recovery_code_used", method: "recovery_code" });
    return true;
}

/** Makes a new set of recovery codes for the signed-in account, replacing the old set. */
export async function makeRecoveryCodes(ctx: AuthContext, actor: Actor): Promise<{ ok: true; codes: string[] }> {
    return { ok: true, codes: await issueRecoveryCodes(ctx, actor.account.id, actor.address) };
}

/** Records a second way of signing in being added, and gives ten recovery codes when the account has none yet, to show once. */
export async function recordWayAdded(ctx: AuthContext, actor: Actor, added: { event: SecurityEventName; method: string }): Promise<string[] | null> {
    await recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, event: added.event, method: added.method });
    const first = (await ctx.stores.tokens.recoveryCodesLeft(actor.account.id)) === 0;
    return first ? issueRecoveryCodes(ctx, actor.account.id, actor.address) : null;
}

export const recoveryCodeWay: ProofWay = {
    kind: "recovery_code",
    readProof: (fields) => (typeof fields.code === "string" ? { code: fields.code } : null),
    matches: async (ctx, account, proof, address) => account !== null && recoveryCodeMatches(ctx, account, { code: proof.code ?? "", address }),
};

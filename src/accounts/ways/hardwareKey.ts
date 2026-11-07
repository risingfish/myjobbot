import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import type { Account } from "../../db/accountStore.js";
import type { ChallengePurpose, StoredKey } from "../../db/keyStore.js";
import { registrationOptions, signInOptions, verifiedCredential, verifiedSignIn } from "../keys.js";
import { MESSAGES } from "../messages.js";
import { checkKeyName } from "../names.js";
import { tokenDigest } from "../tokens.js";
import { wayUsable } from "./usable.js";
import type { Actor, AuthContext, Refused } from "../flows/context.js";
import { recordWayAdded } from "./recoveryCode.js";
import { recordSecurityEvent } from "../flows/securityEvents.js";
import type { ProofWay } from "./registry.js";

const UNAVAILABLE: Refused = { ok: false, message: MESSAGES.key_unavailable };

/** Returns a check that spends a key challenge of a purpose as it is checked, for the account given when there is one. */
function spendsChallenge(ctx: AuthContext, purpose: ChallengePurpose, userId: number | null): (challenge: string) => Promise<boolean> {
    return async (challenge) => {
        const spent = await ctx.stores.keys.spendChallenge(tokenDigest(challenge), purpose, ctx.now());
        return spent !== null && (userId === null || spent.userId === userId);
    };
}

/** Starts adding a hardware key under a new name: registration options with a fresh challenge for this account. */
export async function startKeyRegistration(ctx: AuthContext, actor: Actor, rawName: string): Promise<{ ok: true; options: PublicKeyCredentialCreationOptionsJSON } | Refused> {
    const name = checkKeyName(rawName);
    if (!name.ok) return name;
    if (ctx.relyingParty === null) return UNAVAILABLE;
    if ((await ctx.stores.keys.keys(actor.account.id)).some((key) => key.name === name.name)) return { ok: false, message: MESSAGES.key_name_taken };
    const options = await registrationOptions(ctx.relyingParty, { id: actor.account.id, email: actor.account.email ?? "" }, await ctx.stores.keys.credentialsOf(actor.account.id));
    await ctx.stores.keys.makeChallenge(tokenDigest(options.challenge), { purpose: "register", userId: actor.account.id }, ctx.now());
    return { ok: true, options };
}

/** Adds the key the browser registered under its name, giving ten recovery codes the first time the account has none. */
export async function finishKeyRegistration(ctx: AuthContext, actor: Actor, input: { name: string; response: unknown }): Promise<{ ok: true; recoveryCodes: string[] | null } | Refused> {
    const name = checkKeyName(input.name);
    if (!name.ok) return name;
    if (ctx.relyingParty === null) return UNAVAILABLE;
    const credential = await verifiedCredential(input.response as RegistrationResponseJSON, { rp: ctx.relyingParty, challenge: spendsChallenge(ctx, "register", actor.account.id) });
    const added = credential === null ? "failed" : await ctx.stores.keys.addKey(actor.account.id, { ...credential, name: name.name }, ctx.now());
    if (added !== "ok") return { ok: false, message: added === "name_taken" ? MESSAGES.key_name_taken : MESSAGES.key_failed };
    return { ok: true, recoveryCodes: await recordWayAdded(ctx, actor, { event: "key_added", method: "hardware_key" }) };
}

/** Deletes one of the account's keys, never when that leaves no usable way. */
export async function removeKey(ctx: AuthContext, actor: Actor, id: number): Promise<{ ok: true } | Refused> {
    if ((await ctx.stores.keys.removeKey(actor.account.id, { id, mailOn: ctx.mail !== null }, ctx.now())) === "last_way") return { ok: false, message: MESSAGES.last_way };
    await recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, event: "key_removed", method: "hardware_key" });
    return { ok: true };
}

/** Starts a key sign-in or confirmation: options naming no key, with a fresh challenge. */
export async function startKeySignIn(ctx: AuthContext): Promise<{ ok: true; options: PublicKeyCredentialRequestOptionsJSON } | Refused> {
    if (ctx.relyingParty === null) return UNAVAILABLE;
    const options = await signInOptions(ctx.relyingParty);
    await ctx.stores.keys.makeChallenge(tokenDigest(options.challenge), { purpose: "signin", userId: null }, ctx.now());
    return { ok: true, options };
}

/** Finds the stored key a browser answered with, when it belongs to the account and the account's hardware keys are usable. */
async function accountKey(ctx: AuthContext, account: Account | null, response: unknown): Promise<StoredKey | null> {
    if (account === null || !(await wayUsable(ctx, account.id, "hardware_key"))) return null;
    const id = (response as { id?: unknown } | null)?.id;
    const stored = typeof id === "string" ? await ctx.stores.keys.keyByCredential(id) : null;
    return stored?.userId === account.id ? stored : null;
}

/** Says whether a browser's key answer is a right one from one of the account's keys, and keeps its counter; a counter that doesn't move on is refused and recorded. */
async function keyMatches(ctx: AuthContext, account: Account | null, response: unknown): Promise<boolean> {
    const stored = await accountKey(ctx, account, response);
    if (stored === null || ctx.relyingParty === null) return false;
    const counter = await verifiedSignIn(response as AuthenticationResponseJSON, { rp: ctx.relyingParty, key: stored, challenge: spendsChallenge(ctx, "signin", null) });
    if (counter === null) return false;
    if ((counter > 0 || stored.counter > 0) && counter <= stored.counter) {
        await recordSecurityEvent(ctx, { userId: stored.userId, at: ctx.now(), address: null, event: "key_counter_error", method: "hardware_key" });
        return false;
    }
    await ctx.stores.keys.updateCounter(stored.id, counter, ctx.now());
    return true;
}

export const hardwareKeyWay: ProofWay = {
    kind: "hardware_key",
    readProof: (fields) => (fields.response === undefined ? null : { response: fields.response }),
    matches: (ctx, account, proof) => keyMatches(ctx, account, proof.response),
};

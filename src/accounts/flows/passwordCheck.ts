import type { Account } from "../../db/accountStore.js";
import { standInDigest, verifyPassword } from "../passwordDigest.js";
import { actorTry, recordFailure, signInLocked } from "./attempts.js";
import type { Actor, AuthContext } from "./context.js";

/** Checks a password against the account's, or against the stand-in when there is no usable one, so both take as long. */
export async function passwordMatches(ctx: AuthContext, account: Account | null, password: string): Promise<boolean> {
    const digest = account === null ? null : await ctx.stores.methods.passwordDigest(account.id);
    const matched = await verifyPassword(password, digest ?? (await standInDigest()));
    return matched && digest !== null;
}

/** Checks a signed-in account's current password under the sign-in limits, so a held session can't be used to guess it. */
export async function currentPasswordMatches(ctx: AuthContext, actor: Actor, password: string): Promise<boolean> {
    const attempt = actorTry(actor, "password");
    if (!(await signInLocked(ctx, attempt)) && (await passwordMatches(ctx, actor.account, password))) return true;
    await recordFailure(ctx, attempt);
    return false;
}

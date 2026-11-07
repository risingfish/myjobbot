import type { MethodKind } from "../../db/methodStore.js";
import type { AuthContext } from "../flows/context.js";
import { usable } from "../methods.js";

/** Says whether one of an account's ways can be used to sign in now: switched on, set up, and for emailed links only while mail is set up. */
export async function wayUsable(ctx: AuthContext, userId: number, kind: MethodKind): Promise<boolean> {
    const way = (await ctx.stores.methods.methods(userId)).find((row) => row.kind === kind);
    return way !== undefined && usable(way, { mailOn: ctx.mail !== null });
}

"use server";

import { revalidatePath } from "next/cache.js";
import { deactivate, reactivate } from "../../src/accounts/flows/accountStatus.js";
import { disconnect } from "../../src/gmail/connection.js";
import { noInput, signedInAction } from "./accountAction.js";
import type { AccountAnswer } from "./accountActions.js";
import { guarded } from "./guard.js";
import { myStores } from "./myStores.js";

/** Deactivates the signed-in account: runs stop for it and its Gmail connection is removed. */
const deactivateAccountAction = signedInAction(noInput, async ({ ctx, actor }): Promise<AccountAnswer> => {
    const mine = await myStores();
    const answer = await deactivate(ctx, actor, () => disconnect(mine));
    revalidatePath("/", "layout");
    return answer;
});

/** Reactivates the signed-in account so runs work for it again. */
const reactivateAccountAction = signedInAction(noInput, async ({ ctx, actor }): Promise<AccountAnswer> => {
    const answer = await reactivate(ctx, actor);
    revalidatePath("/", "layout");
    return answer;
});

export const deactivateAccount = guarded(deactivateAccountAction, {});
export const reactivateAccount = guarded(reactivateAccountAction, {});

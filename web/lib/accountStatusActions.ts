"use server";

import { revalidatePath } from "next/cache.js";
import { z } from "zod";
import { cancelDeletion, requestDeletion } from "../../src/accounts/flows/accountDeletion.js";
import { deactivate, reactivate } from "../../src/accounts/flows/accountStatus.js";
import { disconnect } from "../../src/gmail/connection.js";
import { noInput, parsedWith, signedInAction } from "./accountAction.js";
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

const typedEmail = z.string().max(254);

/** Asks for the signed-in account to be deleted in 30 days, once its email is typed; it is deactivated at once. */
const requestAccountDeletionAction = signedInAction(
    (email: unknown) => parsedWith(typedEmail, email),
    async ({ ctx, actor }, email): Promise<AccountAnswer> => {
        const mine = await myStores();
        const answer = await requestDeletion(ctx, actor, () => disconnect(mine), email);
        revalidatePath("/", "layout");
        return answer;
    },
);

/** Calls off the signed-in account's pending deletion. */
const cancelAccountDeletionAction = signedInAction(noInput, async ({ ctx, actor }): Promise<AccountAnswer> => {
    const answer = await cancelDeletion(ctx, actor);
    revalidatePath("/", "layout");
    return answer;
});

export const requestAccountDeletion = guarded(requestAccountDeletionAction, { stepUp: true });
export const cancelAccountDeletion = guarded(cancelAccountDeletionAction, {});

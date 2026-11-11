import type { AccountRemoval } from "../db/accountRemoval.js";
import type { AccountStore } from "../db/accountStore.js";
import { describeError } from "../errors.js";
import { runFailureReason } from "../monitoring/failureReason.js";
import type { MailMessage } from "../mail/mailer.js";
import { accountDeleted } from "../mail/messages.js";
import type { UserRun } from "./runLines.js";

export interface DeletionParts {
    removal: AccountRemoval;
    accounts: Pick<AccountStore, "account">;
    send: (message: MailMessage) => Promise<void>;
}

/** Carries out every deletion that is due, telling each deleted account once it is gone; a held deletion stays, and one that fails doesn't stop the rest. */
export async function carryOutDeletions(parts: DeletionParts, now: string): Promise<UserRun[]> {
    const runs: UserRun[] = [];
    for (const userId of await parts.removal.due(now)) {
        const run = await carryOutOne(parts, userId, now);
        if (run !== null) runs.push(run);
    }
    return runs;
}

/** Deletes one account whose deletion is due, then mails the address it had; null when it was cancelled or already gone. */
async function carryOutOne(parts: DeletionParts, userId: number, now: string): Promise<UserRun | null> {
    try {
        const account = await parts.accounts.account(userId);
        const outcome = await parts.removal.remove(userId, now);
        if (outcome === "last_admin") return { userId, held: "last_admin" };
        if (outcome !== "deleted") return null;
        if (account?.email) await parts.send({ to: account.email, ...accountDeleted(account.name) });
        return { userId, deleted: true };
    } catch (error) {
        return { userId, failed: describeError(error), reason: runFailureReason(error) };
    }
}

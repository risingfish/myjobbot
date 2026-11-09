import type { Account } from "../db/accountStore.js";
import { MESSAGES } from "./messages.js";

type Status = Pick<Account, "deactivatedAt" | "deleteAfter">;

/** Gives the refusal for work that scores or reads mail while the account is deactivated, or null when it may go ahead. */
export function reactivateFirst(account: Status): string | null {
    return account.deactivatedAt === null ? null : MESSAGES.reactivate_first;
}

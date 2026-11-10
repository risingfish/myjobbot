import type { Account } from "../db/accountStore.js";
import { MESSAGES } from "./messages.js";

type Status = Pick<Account, "deactivatedAt" | "deleteAfter">;

/** Gives the refusal for work that scores or reads mail while the account is deactivated, or null when it may go ahead. */
export function reactivateFirst(account: Status): string | null {
    return account.deactivatedAt === null ? null : MESSAGES.reactivate_first;
}

export type AccountLifecycle = "active" | "deactivated" | "pending_deletion" | "held";

/** Names where an account stands: active, deactivated, waiting for its deletion, or held because its deletion is due but it is the only admin. */
export function statusOf(account: Status, now: string, onlyAdmin: boolean): AccountLifecycle {
    if (account.deactivatedAt === null) return "active";
    if (account.deleteAfter === null) return "deactivated";
    return account.deleteAfter <= now && onlyAdmin ? "held" : "pending_deletion";
}

const DELETION_DAYS = 30;

/** Gives when a deletion asked for now is carried out: 30 days on. */
export function deletionDate(now: string): string {
    return new Date(Date.parse(now) + DELETION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Says whether an account may ask to be deleted: never while it holds the only admin mark. */
export function mayRequestDeletion(onlyAdmin: boolean): boolean {
    return !onlyAdmin;
}

import { reactivateFirst } from "../../src/accounts/accountLifecycle.js";
import { requireSession } from "./session.js";

/** Gives the refusal for work that scores or reads mail for the signed-in account, or null when it may go ahead. */
export async function scoringRefusal(): Promise<string | null> {
    return reactivateFirst((await requireSession()).account);
}

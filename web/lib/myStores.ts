import type { UserStores } from "../../src/db/userStores.js";
import { openedStores } from "./database.js";
import { requireSession } from "./session.js";

/** Returns the signed-in user's stores, each bound to them, sending a signed-out browser to sign in before anything is read. */
export async function myStores(): Promise<UserStores> {
    const { account } = await requireSession();
    return (await openedStores()).forUser(account.id);
}

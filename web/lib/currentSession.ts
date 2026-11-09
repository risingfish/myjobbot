import { cookies } from "next/headers.js";
import { cache } from "react";
import { tokenDigest } from "../../src/accounts/tokens.js";
import type { Account } from "../../src/db/accountStore.js";
import type { Session } from "../../src/db/sessionStore.js";
import { webSettings } from "./webSettings.js";
import { openedStores } from "./database.js";

export interface SignedIn {
    session: Session;
    account: Account;
}

/** Returns this request's sign-in and its account, read once per request from the sign-in cookie, or null when there is none. */
export const currentSession = cache(async (): Promise<SignedIn | null> => {
    const settings = webSettings();
    const value = settings === null ? undefined : (await cookies()).get(settings.cookies.session.name)?.value;
    if (value === undefined) return null;
    const stores = await openedStores();
    const session = await stores.sessions.find(tokenDigest(value), new Date().toISOString());
    const account = session === null ? null : await stores.accounts.account(session.userId);
    return session === null || account === null ? null : { session, account };
});

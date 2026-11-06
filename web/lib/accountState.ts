import { requireSession } from "./session.js";

export interface AccountState {
    name: string;
    email: string;
}

/** Returns what the Account page shows about the signed-in account, confirming the sign-in before anything is read. */
export async function getAccountState(): Promise<AccountState> {
    const { account } = await requireSession();
    return { name: account.name, email: account.email ?? "" };
}

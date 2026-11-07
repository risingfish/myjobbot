import type { Metadata } from "next";
import { AccountView } from "../../../components/account/AccountView.js";
import { getAccountState } from "../../../lib/accountState.js";

export const metadata: Metadata = { title: "Account" };

/** Renders the Account page for the signed-in account. */
export default async function AccountPage() {
    return (
        <main className="container-fluid" aria-label="Account">
            <AccountView state={await getAccountState()} />
        </main>
    );
}

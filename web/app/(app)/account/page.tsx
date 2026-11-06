import type { Metadata } from "next";
import { getAccountState } from "../../../lib/accountState.js";

export const metadata: Metadata = { title: "Account" };

/** Renders the Account page: the signed-in account's name and email. */
export default async function AccountPage() {
    const state = await getAccountState();
    return (
        <main className="container-fluid" aria-label="Account">
            <article>
                <header>Account</header>
                <p>
                    <strong>{state.name}</strong>
                    <br />
                    {state.email}
                </p>
            </article>
        </main>
    );
}

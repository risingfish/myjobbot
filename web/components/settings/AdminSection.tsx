"use client";

import { useState } from "react";
import type { Account } from "../../../src/db/accountStore.js";
import { makeAccountCodeNow, setAdminMark, type CodeAnswer } from "../../lib/adminActions.js";
import { shownRefusal, StepUpProvider, useStepUp } from "../account/StepUp.js";
import { Panel } from "../sections/Panel.js";
import { SettingCard } from "./SettingParts.js";

/** Renders the button that makes an account creation code, then the code, shown once, with its expiry and a Copy button. */
function CodeMaker() {
    const run = useStepUp();
    const [answer, setAnswer] = useState<CodeAnswer | null>(null);
    const [busy, setBusy] = useState(false);
    const make = async () => {
        setBusy(true);
        const made = await run(() => makeAccountCodeNow());
        setAnswer(made.ok || shownRefusal(made) !== null ? made : null);
        setBusy(false);
    };
    return (
        <SettingCard title="Account creation code">
            <button type="button" aria-busy={busy} disabled={busy} onClick={() => void make()}>
                Make account creation code
            </button>
            {answer !== null && <CodeShown answer={answer} />}
        </SettingCard>
    );
}

/** Shows a new code once, with when it stops working and a button that copies it, or why none was made. */
function CodeShown({ answer }: { answer: CodeAnswer }) {
    if (!answer.ok) return <p role="alert">{answer.message}</p>;
    return (
        <>
            <pre>
                <code>{answer.code}</code>
            </pre>
            <button type="button" className="secondary outline" onClick={() => void navigator.clipboard.writeText(answer.code)}>
                Copy
            </button>{" "}
            <small>Works once, until {answer.expiresAt.slice(0, 16).replace("T", " ")} UTC. It isn't shown again.</small>
        </>
    );
}

/** Renders one account's row with the button that grants or removes its admin mark. */
function AccountRow({ account, onChange }: { account: Account; onChange: (account: Account) => void }) {
    return (
        <tr>
            <td>{account.name}</td>
            <td>{account.email}</td>
            <td>{account.isAdmin ? "Admin" : ""}</td>
            <td>
                <button type="button" className="outline" onClick={() => onChange(account)}>
                    {account.isAdmin ? "Remove admin" : "Make admin"}
                </button>
            </td>
        </tr>
    );
}

/** Renders the table of accounts, each row with its admin control. */
function AccountsTable({ accounts, onChange }: { accounts: Account[]; onChange: (account: Account) => void }) {
    return (
        <table className="striped">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Admin</th>
                    <th />
                </tr>
            </thead>
            <tbody>
                {accounts.map((account) => (
                    <AccountRow key={account.id} account={account} onChange={onChange} />
                ))}
            </tbody>
        </table>
    );
}

/** Renders the list of accounts with their admin marks, and why a change was refused. */
function AccountList({ accounts }: { accounts: Account[] }) {
    const run = useStepUp();
    const [refusal, setRefusal] = useState<string | null>(null);
    const change = async (account: Account) => setRefusal(shownRefusal(await run(() => setAdminMark(account.id, !account.isAdmin))));
    return (
        <SettingCard title="Accounts">
            <AccountsTable accounts={accounts} onChange={(target) => void change(target)} />
            {refusal !== null && <p role="alert">{refusal}</p>}
        </SettingCard>
    );
}

/** Renders the admin section of the Settings page, shown only to admins: account creation codes and the accounts with their admin marks, each change asking to confirm it's them when due. */
export function AdminSection({ accounts }: { accounts: Account[] }) {
    return (
        <StepUpProvider>
            <Panel title="Admin">
                <CodeMaker />
                <AccountList accounts={accounts} />
            </Panel>
        </StepUpProvider>
    );
}

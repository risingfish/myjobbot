"use client";

import { useState } from "react";
import { minutes } from "../../../src/time/minutes.js";
import { MESSAGES } from "../../../src/accounts/messages.js";
import { cancelAccountDeletion, deactivateAccount, reactivateAccount } from "../../lib/accountStatusActions.js";
import type { AccountStatusView } from "../../lib/accountState.js";
import { Panel } from "../sections/Panel.js";
import { DeleteAccountForm } from "./DeleteAccountForm.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

type Change = (action: () => Promise<{ ok: boolean; message?: string; stepUp?: true }>) => Promise<void>;

/** Says where the account stands, in words. */
function statusText(view: AccountStatusView): string {
    if (view.status === "active") return "Active: runs fetch and score jobs for you.";
    if (view.status === "deactivated") return `Deactivated since ${minutes(view.deactivatedAt ?? "")} UTC. Runs do nothing for you; Gmail is disconnected.`;
    if (view.status === "held") return "Due for deletion, held: make another admin first.";
    return `Will be deleted on ${minutes(view.deleteAfter ?? "")} UTC.`;
}

/** Gives the label and action of the button that moves the account on from where it stands: Deactivate, asking on the page first, Reactivate, or Cancel deletion. */
function statusButton(status: AccountStatusView["status"], change: Change, ask: () => void): { label: string; onClick: () => void } {
    if (status === "active") return { label: "Deactivate account", onClick: ask };
    if (status === "deactivated") return { label: "Reactivate", onClick: () => void change(reactivateAccount) };
    return { label: "Cancel deletion", onClick: () => void change(cancelAccountDeletion) };
}

/** Renders the button that moves the account on from where it stands, full size as a form's own submit button. */
function StatusButton({ view, change, ask }: { view: AccountStatusView; change: Change; ask: () => void }) {
    const button = statusButton(view.status, change, ask);
    return (
        <form action={button.onClick}>
            <button>{button.label}</button>
        </form>
    );
}

/** Renders Delete account for an account not already due for deletion, greyed out with the reason for the only admin, opening the form that asks for the email. */
function DeleteControls({ view, change }: { view: AccountStatusView; change: Change }) {
    const [open, setOpen] = useState(false);
    if (view.status === "pending_deletion" || view.status === "held") return null;
    if (open) return <DeleteAccountForm change={change} />;
    return (
        <form action={() => setOpen(true)}>
            <button className="secondary" disabled={view.onlyAdmin}>
                Delete account
            </button>
            {view.onlyAdmin && <small>{MESSAGES.last_admin_delete}</small>}
        </form>
    );
}

/** Asks on the page before deactivating, saying what deactivating does. */
function DeactivateDialog({ open, onDeactivate, onCancel }: { open: boolean; onDeactivate: () => void; onCancel: () => void }) {
    return (
        <dialog open={open} aria-labelledby="deactivate-title">
            <article>
                <h3 id="deactivate-title">Deactivate your account?</h3>
                <p>Runs will stop fetching and scoring jobs for you, and Gmail will be disconnected. You can still sign in, and reactivate at any time.</p>
                <footer>
                    <button type="button" className="secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" onClick={onDeactivate}>
                        Deactivate
                    </button>
                </footer>
            </article>
        </dialog>
    );
}

/** Renders the Account status panel: where the account stands, the buttons that change it, and why a change was refused. */
function StatusPanel({ status, change, ask, refusal }: { status: AccountStatusView; change: Change; ask: () => void; refusal: string | null }) {
    return (
        <Panel title="Account status">
            <p>{statusText(status)}</p>
            <div className="status-actions">
                <StatusButton view={status} change={change} ask={ask} />
                <DeleteControls key={status.status} view={status} change={change} />
            </div>
            {refusal !== null && <small role="alert">{refusal}</small>}
        </Panel>
    );
}

/** Renders the Account status section, with the dialog that asks before deactivating. */
export function AccountStatus({ status }: { status: AccountStatusView }) {
    const run = useStepUp();
    const [refusal, setRefusal] = useState<string | null>(null);
    const [asking, setAsking] = useState(false);
    const change: Change = async (action) => setRefusal(shownRefusal(await run(action)));
    const deactivateNow = () => {
        setAsking(false);
        void change(deactivateAccount);
    };
    return (
        <>
            <StatusPanel status={status} change={change} ask={() => setAsking(true)} refusal={refusal} />
            <DeactivateDialog open={asking} onDeactivate={deactivateNow} onCancel={() => setAsking(false)} />
        </>
    );
}

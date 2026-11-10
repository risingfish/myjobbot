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

const CONFIRM_DEACTIVATE = "Deactivate your account? Runs will stop fetching and scoring jobs for you, and Gmail will be disconnected.";

/** Says where the account stands, in words. */
function statusText(view: AccountStatusView): string {
    if (view.status === "active") return "Active: runs fetch and score jobs for you.";
    if (view.status === "deactivated") return `Deactivated since ${minutes(view.deactivatedAt ?? "")} UTC. Runs do nothing for you; Gmail is disconnected.`;
    if (view.status === "held") return "Due for deletion, held: make another admin first.";
    return `Will be deleted on ${minutes(view.deleteAfter ?? "")} UTC.`;
}

/** Gives the label and action of the button that moves the account on from where it stands: Deactivate, asking first, Reactivate, or Cancel deletion. */
function statusButton(status: AccountStatusView["status"], change: Change): { label: string; onClick: () => void } {
    if (status === "active") return { label: "Deactivate account", onClick: () => window.confirm(CONFIRM_DEACTIVATE) && void change(deactivateAccount) };
    if (status === "deactivated") return { label: "Reactivate", onClick: () => void change(reactivateAccount) };
    return { label: "Cancel deletion", onClick: () => void change(cancelAccountDeletion) };
}

/** Renders the button that moves the account on from where it stands, full size as a form's own submit button. */
function StatusButton({ view, change }: { view: AccountStatusView; change: Change }) {
    const button = statusButton(view.status, change);
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

/** Renders the Account status section: where the account stands and the button that changes it, with why a change was refused. */
export function AccountStatus({ status }: { status: AccountStatusView }) {
    const run = useStepUp();
    const [refusal, setRefusal] = useState<string | null>(null);
    const change: Change = async (action) => setRefusal(shownRefusal(await run(action)));
    return (
        <Panel title="Account status">
            <p>{statusText(status)}</p>
            <div className="status-actions">
                <StatusButton view={status} change={change} />
                <DeleteControls key={status.status} view={status} change={change} />
            </div>
            {refusal !== null && <small role="alert">{refusal}</small>}
        </Panel>
    );
}

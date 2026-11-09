"use client";

import { useState } from "react";
import { minutes } from "../../../src/time/minutes.js";
import { deactivateAccount, reactivateAccount } from "../../lib/accountStatusActions.js";
import type { AccountStatusView } from "../../lib/accountState.js";
import { Panel } from "../sections/Panel.js";
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

/** Renders the button that moves the account on from where it stands: Deactivate, asking first, or Reactivate. */
function StatusButton({ view, change }: { view: AccountStatusView; change: Change }) {
    const deactivateNow = () => {
        if (window.confirm(CONFIRM_DEACTIVATE)) void change(deactivateAccount);
    };
    if (view.status === "active")
        return (
            <button type="button" onClick={deactivateNow}>
                Deactivate account
            </button>
        );
    if (view.status !== "deactivated") return null;
    return (
        <button type="button" onClick={() => void change(reactivateAccount)}>
            Reactivate
        </button>
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
            <StatusButton view={status} change={change} />
            {refusal !== null && <small role="alert">{refusal}</small>}
        </Panel>
    );
}

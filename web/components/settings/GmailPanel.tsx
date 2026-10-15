import type { GmailPanelView } from "../../../src/web/gmailPanel.js";
import { clearGmailCredentials, connectGmail } from "../../lib/gmailActions.js";
import { Panel } from "../sections/Panel.js";
import { CheckNow } from "./CheckNow.js";
import { CredentialsForm } from "./CredentialsForm.js";
import { DisconnectButton } from "./DisconnectButton.js";

interface GmailPanelProps {
    view: GmailPanelView;
    notice: string | null;
}

/** Renders the Gmail connection panel from its precomputed view, offering only what the view allows. */
export function GmailPanel({ view, notice }: GmailPanelProps) {
    const offers = new Set(view.offers);
    return (
        <Panel title="Gmail">
            {notice && <p role="status">{notice}</p>}
            {view.message && <p className="note">{view.message}</p>}
            <GmailStatus view={view} />
            {offers.has("connect") && <ConnectForm view={view} />}
            {offers.has("check") && <CheckNow />}
            {offers.has("disconnect") && <DisconnectButton />}
            {offers.has("save") && <CredentialsForm />}
            <CredentialChanges offers={offers} />
        </Panel>
    );
}

/** Renders where the connection stands: connected, needing to reconnect, or which OAuth client is saved. */
function GmailStatus({ view }: { view: GmailPanelView }) {
    if (view.state === "connected") return <p>{`Connected as ${view.email ?? ""} since ${view.connectedAt ?? ""}`}</p>;
    if (view.state === "needs_reconnect") return <p>{`Needs reconnecting: ${view.reason ?? ""}`}</p>;
    if (!view.secretSaved) return <p>Not connected</p>;
    return <p>{`Not connected · client ID ${view.clientId ?? ""} · secret saved`}</p>;
}

/** Renders the Connect Gmail button, disabled with a hint when Google couldn't send the owner back here. */
function ConnectForm({ view }: { view: GmailPanelView }) {
    return (
        <form action={connectGmail}>
            <button disabled={!view.canConnect}>Connect Gmail</button>
            {view.connectHint && <p className="note">{view.connectHint}</p>}
        </form>
    );
}

/** Renders the ways to change saved credentials: replacing them, or clearing them. */
function CredentialChanges({ offers }: { offers: Set<string> }) {
    return (
        <>
            {offers.has("replace") && (
                <details>
                    <summary>Replace credentials</summary>
                    <CredentialsForm />
                </details>
            )}
            {offers.has("clear") && (
                <form action={clearGmailCredentials}>
                    <button>Clear credentials</button>
                </form>
            )}
        </>
    );
}

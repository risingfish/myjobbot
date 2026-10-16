import type { GmailPanelView } from "../../../src/web/gmailPanel.js";
import { Panel } from "../sections/Panel.js";
import { CheckNow } from "./CheckNow.js";
import { ConnectForm } from "./ConnectForm.js";
import { DisconnectButton } from "./DisconnectButton.js";

/** Renders the Gmail connection panel from its precomputed view, offering only what the view allows. */
export function GmailPanel({ view }: { view: GmailPanelView }) {
    const offers = new Set(view.offers);
    return (
        <Panel title="Gmail">
            <GmailStatus view={view} />
            {view.lastRun && <p className="note">{view.lastRun}</p>}
            {view.message && <p className="note">{view.message}</p>}
            {offers.has("connect") && <ConnectForm />}
            {offers.has("check") && <CheckNow />}
            {offers.has("disconnect") && <DisconnectButton />}
            {offers.has("replace") && (
                <details>
                    <summary>Use a different account or app password</summary>
                    <ConnectForm />
                </details>
            )}
        </Panel>
    );
}

/** Renders where the connection stands: connected, needing a new app password, or not connected. */
function GmailStatus({ view }: { view: GmailPanelView }) {
    if (view.state === "connected") return <p>{`Connected as ${view.email ?? ""} since ${view.connectedAt ?? ""}`}</p>;
    if (view.state === "needs_reconnect") return <p>{`Needs reconnecting: ${view.reason ?? ""}`}</p>;
    return <p>Not connected</p>;
}

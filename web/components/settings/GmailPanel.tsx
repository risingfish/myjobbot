import type { GmailPanelView } from "../../../src/web/gmailPanel.js";
import { clearGmailCredentials } from "../../lib/gmailActions.js";
import { Panel } from "../sections/Panel.js";
import { CredentialsForm } from "./CredentialsForm.js";

/** Renders the Gmail connection panel from its precomputed view, offering only what the view allows. */
export function GmailPanel({ view }: { view: GmailPanelView }) {
    const offers = new Set(view.offers);
    return (
        <Panel title="Gmail">
            {view.message && <p className="note">{view.message}</p>}
            <GmailStatus view={view} />
            {offers.has("save") && <CredentialsForm />}
            <CredentialChanges offers={offers} />
        </Panel>
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

/** Renders where the connection stands: whether Gmail is connected and which OAuth client is saved. */
function GmailStatus({ view }: { view: GmailPanelView }) {
    if (!view.secretSaved) return <p>Not connected</p>;
    return <p>Not connected · client ID {view.clientId} · secret saved</p>;
}

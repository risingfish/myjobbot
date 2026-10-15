import type { Metadata } from "next";
import { headers } from "next/headers.js";
import { keyChanged } from "../../../src/gmail/connection.js";
import { gmailPanelView, type GmailPanelView } from "../../../src/web/gmailPanel.js";
import { Panel } from "../../components/sections/Panel.js";
import { GmailPanel } from "../../components/settings/GmailPanel.js";
import { getUiState } from "../../lib/uiState.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Renders the Settings page: scoring and the Gmail connection. */
export default async function SettingsPage() {
    return (
        <main aria-label="Settings">
            <Panel title="Scoring" actions={<button>Save</button>}>
                <p>Match threshold: 70</p>
            </Panel>
            <GmailPanel view={await gmailView()} />
        </main>
    );
}

/** Builds the Gmail panel's view from the stored connection, the server key and the address Settings was opened on. */
async function gmailView(): Promise<GmailPanelView> {
    const [{ gmail, key }, requestHeaders] = await Promise.all([getUiState(), headers()]);
    const row = await gmail.connection();
    const changed = key.status === "ok" && keyChanged({ gmail, key: key.key }, row);
    return gmailPanelView(row, { keyStatus: key.status, keyChanged: changed, host: requestHeaders.get("host") ?? "" });
}

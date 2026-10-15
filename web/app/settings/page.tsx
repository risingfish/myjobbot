import type { Metadata } from "next";
import { headers } from "next/headers.js";
import { keyChanged } from "../../../src/gmail/connection.js";
import { outcomeMessage } from "../../../src/web/gmailOutcomes.js";
import { gmailPanelView, type GmailPanelView } from "../../../src/web/gmailPanel.js";
import { Panel } from "../../components/sections/Panel.js";
import { GmailPanel } from "../../components/settings/GmailPanel.js";
import { getUiState } from "../../lib/uiState.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

interface SettingsProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Renders the Settings page: scoring and the Gmail connection, with the outcome of a sign-in the owner just finished. */
export default async function SettingsPage({ searchParams }: SettingsProps) {
    return (
        <main aria-label="Settings">
            <Panel title="Scoring" actions={<button>Save</button>}>
                <p>Match threshold: 70</p>
            </Panel>
            <GmailPanel view={await gmailView()} notice={outcomeMessage((await searchParams).gmail)} />
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

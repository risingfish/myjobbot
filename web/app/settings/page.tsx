import type { Metadata } from "next";
import { keyChanged } from "../../../src/gmail/connection.js";
import { gmailPanelView, type GmailPanelView } from "../../../src/web/gmailPanel.js";
import { Panel } from "../../components/sections/Panel.js";
import { GmailPanel } from "../../components/settings/GmailPanel.js";
import { SettingsNotices } from "../../components/settings/SettingsNotices.js";
import { getUiState } from "../../lib/uiState.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type UiState = Awaited<ReturnType<typeof getUiState>>;

/** Renders the Settings page: what the stored search settings reported, scoring, and the Gmail connection. */
export default async function SettingsPage() {
    const state = await getUiState();
    return (
        <main aria-label="Settings">
            <SettingsNotices notices={state.notices} />
            <Panel title="Scoring" actions={<button>Save</button>}>
                <p>Match threshold: 70</p>
            </Panel>
            <GmailPanel view={await gmailView(state)} />
        </main>
    );
}

/** Builds the Gmail panel's view from the stored connection, the server key and the last alert run. */
async function gmailView({ gmail, alerts, key }: Pick<UiState, "gmail" | "alerts" | "key">): Promise<GmailPanelView> {
    const [row, alertState] = await Promise.all([gmail.connection(), alerts.state()]);
    const changed = key.status === "ok" && keyChanged({ key: key.key }, row);
    return gmailPanelView(row, { keyStatus: key.status, keyChanged: changed, alertState });
}

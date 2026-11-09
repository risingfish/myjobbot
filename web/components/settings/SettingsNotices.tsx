import type { SettingsNotice } from "../../../src/config/resolve.js";
import { noticeLines } from "../../../src/web/settingsNoticeLines.js";
import { Panel } from "../sections/Panel.js";

/** Renders the Settings notices panel: each search setting that fell back and why, the search settings config.json still holds, and boards or searches left over from before saved sources; nothing when there are none. */
export function SettingsNotices({ notices }: { notices: SettingsNotice[] }) {
    const lines = notices.flatMap(noticeLines);
    if (lines.length === 0) return null;
    return (
        <Panel title="Settings notices">
            <ul>
                {lines.map((line) => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
        </Panel>
    );
}

import type { SettingsNotice } from "../../../src/config/resolve.js";
import { Panel } from "../sections/Panel.js";

/** Renders the Settings notices panel: each search setting that fell back and why, and the search settings config.json still holds; nothing when there is neither. */
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

/** Reports whether a fallback replaced a whole setting with its default, rather than leaving out an entry or a key that isn't a search setting. */
function wholeFallback({ setting, reason }: { setting: string; reason: string }): boolean {
    return !setting.endsWith("]") && reason !== "not a search setting";
}

/** Words one notice for the panel, or nothing for a notice that is only traced. */
function noticeLines(notice: SettingsNotice): string[] {
    if (notice.kind === "fallback") return [`${notice.setting} ${wholeFallback(notice) ? "fell back to its default" : "was left out"}: ${notice.reason}`];
    if (notice.kind === "file_ignored") return [`config.json still holds search settings (${notice.keys.join(", ")}), which are no longer used. They can be removed from the file.`];
    return [];
}

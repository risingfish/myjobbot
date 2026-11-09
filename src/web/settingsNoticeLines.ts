import type { SettingsNotice } from "../config/resolve.js";
import { NOT_SEARCH } from "../config/searchSettings.js";

const LINES: { [K in SettingsNotice["kind"]]: (notice: Extract<SettingsNotice, { kind: K }>) => string } = {
    fallback: (notice) => `${notice.setting} ${wholeFallback(notice) ? "fell back to its default" : "was left out"}: ${notice.reason}`,
    retired: (notice) => `Company boards and saved searches are now saved sources, so ${notice.keys.join(" and ")} in config.json or the stored settings are no longer used. They can be removed.`,
    file_ignored: (notice) => `config.json still holds search settings (${notice.keys.join(", ")}), which are no longer used. They can be removed from the file.`,
};

/** Words one notice for the Settings notices panel, by its kind. */
export function noticeLines(notice: SettingsNotice): string[] {
    return [(LINES[notice.kind] as (each: SettingsNotice) => string)(notice)];
}

/** Reports whether a fallback replaced a whole setting with its default, rather than leaving out an entry or a key that isn't a search setting. */
function wholeFallback({ setting, reason }: { setting: string; reason: string }): boolean {
    return !setting.endsWith("]") && reason !== NOT_SEARCH;
}

import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { SettingsNotices } from "../../web/components/settings/SettingsNotices.js";

const NOTICES = [
    { kind: "fallback" as const, setting: "match_threshold", reason: "Too big: expected number to be <=100" },
    { kind: "fallback" as const, setting: "exclude_companies[1]", reason: "filter terms need at least one letter or digit" },
    { kind: "fallback" as const, setting: "http", reason: "not a search setting" },
    { kind: "file_ignored" as const, keys: ["preferences", "title_boosts"] },
    { kind: "retired" as const, keys: ["companies", "searches"] },
];

test("the notices panel lists each fallback, the search settings config.json still holds, and leftover boards and searches, and shows nothing without them", () => {
    const { container } = render(<SettingsNotices notices={NOTICES} />);
    expect([container.querySelector("h4")?.textContent, [...container.querySelectorAll("li")].map((item) => item.textContent)]).toEqual(["Settings notices", ["match_threshold fell back to its default: Too big: expected number to be <=100", "exclude_companies[1] was left out: filter terms need at least one letter or digit", "http was left out: not a search setting", "config.json still holds search settings (preferences, title_boosts), which are no longer used. They can be removed from the file.", "Company boards and saved searches are now saved sources, so companies and searches in config.json or the stored settings are no longer used. They can be removed."]]);
    expect(render(<SettingsNotices notices={[]} />).container.innerHTML).toBe("");
});

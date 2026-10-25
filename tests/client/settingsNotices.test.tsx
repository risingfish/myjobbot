import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { SettingsNotices } from "../../web/components/settings/SettingsNotices.js";

test("the notices panel lists each fallback and the search settings config.json still holds, and shows nothing without them", () => {
    const notices = [
        { kind: "fallback" as const, setting: "match_threshold", reason: "Too big: expected number to be <=100" },
        { kind: "fallback" as const, setting: "companies[1]", reason: "Invalid option" },
        { kind: "fallback" as const, setting: "http", reason: "not a search setting" },
        { kind: "file_ignored" as const, keys: ["searches", "title_boosts"] },
    ];
    const { container } = render(<SettingsNotices notices={notices} />);
    expect([container.querySelector("h4")?.textContent, [...container.querySelectorAll("li")].map((item) => item.textContent)]).toEqual([
        "Settings notices",
        [
            "match_threshold fell back to its default: Too big: expected number to be <=100",
            "companies[1] was left out: Invalid option",
            "http was left out: not a search setting",
            "config.json still holds search settings (searches, title_boosts), which are no longer used. They can be removed from the file.",
        ],
    ]);
    expect([render(<SettingsNotices notices={[]} />).container.innerHTML, render(<SettingsNotices notices={[{ kind: "imported", keys: ["companies"] }]} />).container.innerHTML]).toEqual(["", ""]);
});

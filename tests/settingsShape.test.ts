import { expect, test } from "vitest";
import { LINK_PURPOSES } from "../src/db/emailLinkStore.js";
import { parseLinkFragment } from "../src/web/linkFragment.js";
import { SECTIONS } from "../src/web/settingsSections.js";
import { settingsView } from "../src/web/settingsView.js";

test("every emailed link's purpose is read back from a link's fragment", () => {
    expect(LINK_PURPOSES.map((purpose) => parseLinkFragment(`#p=${purpose}&t=${"a".repeat(43)}`)?.purpose)).toEqual([...LINK_PURPOSES]);
});

test("every Settings field is in exactly one section, and the page shows exactly those fields", () => {
    const names = SECTIONS.map((spec) => spec.name);
    expect([new Set(names).size, Object.keys(settingsView(null).fields).sort()]).toEqual([names.length, [...names].sort()]);
});

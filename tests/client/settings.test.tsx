import { randomBytes } from "node:crypto";
import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import SettingsPage, { metadata } from "../../web/app/settings/page.js";
import { memoryStores } from "../helpers/memoryStore.js";

vi.mock("../../web/lib/uiState.js", async () => {
    const { settingsView } = await import("../../src/web/settingsView.js");
    return { getSettingsState: async () => ({ gmail: memoryStores().gmail, alerts: memoryStores().alerts, key: { status: "ok", key: randomBytes(32) }, notices: [], view: settingsView(null, false) }) };
});
vi.mock("../../web/lib/gmailActions.js", () => ({ connectGmail: vi.fn(), checkGmail: vi.fn(), disconnectGmail: vi.fn() }));
vi.mock("../../web/lib/settingsActions.js", () => ({ saveSettingsSection: vi.fn() }));

test("the settings page holds the search settings sections and the Gmail panel, and is labelled", async () => {
    const { container } = render(await SettingsPage());
    expect(container.querySelector("table")).toBeNull();
    expect([...container.querySelectorAll("main > div > h4")].map((title) => title.textContent)).toEqual(["Sources", "Preferences", "Scoring", "Filters", "Gmail"]);
    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

test("the settings page is titled Settings inside the site's title template", () => {
    expect(metadata.title).toBe("Settings");
});

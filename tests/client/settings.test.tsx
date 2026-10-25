import { randomBytes } from "node:crypto";
import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import SettingsPage, { metadata } from "../../web/app/settings/page.js";
import { memoryStores } from "../helpers/memoryStore.js";

vi.mock("../../web/lib/uiState.js", () => ({ getUiState: async () => ({ gmail: memoryStores().gmail, alerts: memoryStores().alerts, key: { status: "ok", key: randomBytes(32) }, notices: [] }) }));
vi.mock("../../web/lib/gmailActions.js", () => ({ connectGmail: vi.fn(), checkGmail: vi.fn(), disconnectGmail: vi.fn() }));

test("the settings page holds the Scoring and Gmail panels and is labelled", async () => {
    const { container } = render(await SettingsPage());
    expect(container.querySelector("table")).toBeNull();
    expect([...container.querySelectorAll("main > div > h4")].map((title) => title.textContent)).toEqual(["Scoring", "Gmail"]);
    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

test("the settings page is titled Settings inside the site's title template", () => {
    expect(metadata.title).toBe("Settings");
});

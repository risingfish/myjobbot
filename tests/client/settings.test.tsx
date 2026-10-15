import { randomBytes } from "node:crypto";
import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import SettingsPage, { metadata } from "../../web/app/settings/page.js";
import { memoryStores } from "../helpers/memoryStore.js";

vi.mock("../../web/lib/uiState.js", () => ({ getUiState: async () => ({ gmail: memoryStores().gmail, key: { status: "ok", key: randomBytes(32) } }) }));
vi.mock("next/headers.js", () => ({ headers: async () => new Headers({ host: "localhost:8080" }) }));
vi.mock("../../web/lib/gmailActions.js", () => ({ saveGmailCredentials: vi.fn(), clearGmailCredentials: vi.fn(), connectGmail: vi.fn() }));

function settings(gmail?: string) {
    return SettingsPage({ searchParams: Promise.resolve(gmail === undefined ? {} : { gmail }) });
}

test("the settings page holds the Scoring and Gmail panels and is labelled", async () => {
    const { container } = render(await settings());
    expect(container.querySelector("table")).toBeNull();
    expect([...container.querySelectorAll("main > div > h4")].map((title) => title.textContent)).toEqual(["Scoring", "Gmail"]);
    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

test("a sign-in outcome in the address shows its fixed message, and an unknown one shows nothing", async () => {
    const denied = render(await settings("denied"));
    expect(within(denied.container).getByRole("status").textContent).toBe("Access was not granted.");
    const unknown = render(await settings("<b>hi</b>"));
    expect(within(unknown.container).queryByRole("status")).toBeNull();
});

test("the settings page is titled Settings inside the site's title template", () => {
    expect(metadata.title).toBe("Settings");
});

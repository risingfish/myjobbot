import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import SettingsPage, { metadata } from "../../web/app/settings/page.js";

test("the settings page holds one empty panel and is labelled", () => {
    const { container } = render(<SettingsPage />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("main")?.childElementCount).toBe(1);
    expect(container.querySelector("main > div > h4")?.textContent).toBe("");
    expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

test("the settings page is titled Settings inside the site's title template", () => {
    expect(metadata.title).toBe("Settings");
});

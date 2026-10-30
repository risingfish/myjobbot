import { queries, within, type BoundFunctions } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { sourceChoices } from "../../src/web/sourceChoices.js";
import { searchUsage, sourceRows } from "../../src/web/sourceRows.js";
import { SourcesSection } from "../../web/components/settings/SourcesSection.js";
import { savedSources, STRIPE_BOARD } from "../helpers/savedSources.js";

const actions = vi.hoisted(() => ({ setSourceEnabled: vi.fn(), deleteSource: vi.fn(), recognizeSourceLink: vi.fn(), saveSource: vi.fn() }));

vi.mock("../../web/lib/sourceActions.js", () => actions);

type Section = BoundFunctions<typeof queries>;

function renderSection(): Section {
    const saved = savedSources({ companies: [STRIPE_BOARD], searches: [{ name: "Remote", query: "go" }] }).map((source) => (source.module === "jsearch" ? { ...source, enabled: false } : source));
    const sources = { rows: sourceRows(saved, { hasSearchKey: true, gmailConnected: true }), usage: searchUsage(3, 190), choices: sourceChoices({ jsearch_key: true, gmail: true }) };
    return within(render(<SourcesSection sources={sources} />).container);
}

async function flipBothSwitches(section: Section) {
    actions.setSourceEnabled.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, problem: "too many searches" });
    for (const toggle of section.getAllByRole("checkbox", { name: "On" }).slice(0, 2)) await userEvent.click(toggle);
}

async function deleteFirstTwice(section: Section) {
    Object.defineProperty(window, "confirm", { value: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true), configurable: true });
    actions.deleteSource.mockResolvedValue({ ok: false });
    const firstDelete = () => section.getAllByRole("button", { name: "Delete" })[0] as HTMLElement;
    await userEvent.click(firstDelete());
    await userEvent.click(firstDelete());
}

async function addFromLink(section: Section) {
    actions.recognizeSourceLink.mockResolvedValue({ module: "greenhouse", params: { slug: "affirm" }, name: "Affirm" });
    actions.saveSource.mockResolvedValueOnce({ ok: false, problems: [{ field: "name", entry: null, message: "a source with this name already exists" }] }).mockResolvedValueOnce({ ok: true, test: { ok: true, jobs: 12 } });
    await userEvent.type(section.getByRole("textbox", { name: "Paste a jobs page link" }), "https://boards.greenhouse.io/affirm");
    await userEvent.click(section.getByRole("button", { name: "Open" }));
    const form = within(await section.findByRole("form", { name: "Greenhouse source" }));
    expect([form.getByRole("textbox", { name: "Name" }), form.getByRole("textbox", { name: "Board id" })].map((input) => (input as HTMLInputElement).value)).toEqual(["Affirm", "affirm"]);
    await userEvent.click(form.getByRole("button", { name: "Save" }));
    expect((await form.findByRole("alert")).textContent).toBe("a source with this name already exists");
    await userEvent.click(form.getByRole("button", { name: "Save" }));
}

test("the Sources section lists each source with its switch, switches and deletes through the server, and adds a source from a pasted link", async () => {
    const section = renderSection();
    expect(section.getByText("JSearch requests this month: 3 of 190")).toBeTruthy();
    const saved = within(section.getByRole("list", { name: "Saved sources" }));
    expect(saved.getAllByRole("listitem").map((item) => within(item).queryByRole("button", { name: "Delete" }) !== null)).toEqual([true, true, false]);
    await flipBothSwitches(section);
    expect(actions.setSourceEnabled.mock.calls).toEqual([
        [1, false],
        [2, true],
    ]);
    expect(await section.findByText("too many searches")).toBeTruthy();
    await deleteFirstTwice(section);
    expect(actions.deleteSource.mock.calls).toEqual([[1]]);
    expect(await section.findByText("Couldn't save — try again")).toBeTruthy();
    await addFromLink(section);
    expect((await section.findByRole("status")).textContent).toContain("Saved. Test found 12 jobs.");
    expect(actions.saveSource.mock.calls.at(-1)?.[1]).toEqual({ id: null, module: "greenhouse", name: "Affirm", values: { slug: "affirm" } });
});

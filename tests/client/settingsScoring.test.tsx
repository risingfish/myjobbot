import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { settingsView } from "../../src/web/settingsView.js";
import { ScoringSection } from "../../web/components/settings/ScoringSection.js";

const save = vi.hoisted(() => vi.fn());
vi.mock("../../web/lib/settingsActions.js", () => ({ saveSettingsSection: save }));

test("the Scoring section saves its edits, shows a refusal beside the field with the edit kept, offers reset only on stored fields, and says when a save couldn't run", async () => {
    const user = userEvent.setup();
    save.mockResolvedValueOnce({ ok: false, problems: [{ field: "match_threshold", entry: null, message: "Too big: expected number to be <=100" }] }).mockResolvedValueOnce({ ok: false, failed: true });
    render(<ScoringSection view={settingsView({ match_threshold: 60 })} />);
    const threshold = screen.getByLabelText("Match threshold");
    await user.clear(threshold);
    await user.type(threshold, "150");
    await user.click(screen.getByRole("button", { name: "Save Scoring" }));
    expect(await screen.findByText("Too big: expected number to be <=100")).toBeTruthy();
    expect(save).toHaveBeenCalledWith(null, { section: "scoring", edits: { match_threshold: { kind: "value", value: 150 }, title_boosts: { kind: "default" } } });
    expect((threshold as HTMLInputElement).value).toBe("150");
    expect(screen.getAllByRole("button", { name: /^Reset/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Reset Match threshold to default"]);
    await user.click(screen.getByRole("button", { name: "Save Scoring" }));
    expect(await screen.findByText("Couldn't save — try again")).toBeTruthy();
});

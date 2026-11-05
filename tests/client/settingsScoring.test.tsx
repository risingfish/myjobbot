import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { settingsView } from "../../src/web/settingsView.js";
import { ScoringSection } from "../../web/components/settings/ScoringSection.js";

const save = vi.hoisted(() => vi.fn());
vi.mock("../../web/lib/settingsActions.js", () => ({ saveSettingsSection: save }));

test("the Scoring section saves the threshold once it is left, with no Save button, shows a refusal beside the field with the edit kept, offers no reset or default marker, and says when a save couldn't run", async () => {
    const user = userEvent.setup();
    save.mockResolvedValueOnce({ ok: false, problems: [{ field: "match_threshold", entry: null, message: "Too big: expected number to be <=100" }] }).mockResolvedValueOnce({ ok: false, failed: true });
    render(<ScoringSection view={settingsView({ match_threshold: 60, description_boosts: { go: 5 } })} />);
    const threshold = screen.getByLabelText("Match threshold");
    await user.clear(threshold);
    await user.type(threshold, "150");
    expect([save.mock.calls.length, screen.queryByRole("button", { name: /^Save/ })]).toEqual([0, null]);
    await user.tab();
    expect(await screen.findByText("Too big: expected number to be <=100")).toBeTruthy();
    expect(save).toHaveBeenCalledWith(null, { section: "scoring", edits: { match_threshold: { kind: "value", value: 150 }, resume_view: { kind: "default" }, title_boosts: { kind: "default" }, description_boosts: { kind: "value", value: [["go", 5]] } } });
    expect((threshold as HTMLInputElement).value).toBe("150");
    expect([screen.queryAllByRole("button", { name: /^Reset/ }), screen.queryAllByText(/\(default\)/)]).toEqual([[], []]);
    await user.clear(threshold);
    await user.type(threshold, "90{Enter}");
    expect(await screen.findByText("Couldn't save — try again")).toBeTruthy();
    save.mockResolvedValueOnce({ ok: true });
    await user.selectOptions(screen.getByLabelText("What the model reads about you"), "Your resume and profile");
    expect(save).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ edits: expect.objectContaining({ resume_view: { kind: "value", value: "resume_and_profile" } }) }));
});

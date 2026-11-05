import { expect, test } from "vitest";
import { settingsSchema } from "../src/config/schema.js";
import { sanitizeSearchSettings } from "../src/config/searchSettings.js";
import { saveSection } from "../src/web/settingsSave.js";
import { sectionRequest, editedField } from "../src/web/settingsForm.js";

test("what the model reads about the owner starts at the resume alone, and a bad stored choice falls back to it with a notice", () => {
    expect(settingsSchema.parse({}).resume_view).toBe("resume");
    const { settings, notices } = sanitizeSearchSettings({ resume_view: "everything" });
    expect([settings.resume_view, notices.map((notice) => notice.setting)]).toEqual([undefined, ["resume_view"]]);
});

test("the Scoring section saves the choice with the threshold, and refuses one that isn't offered", () => {
    const fields = { match_threshold: editedField(60) };
    const saved = saveSection(null, {}, sectionRequest("scoring", { ...fields, resume_view: editedField("profile") }));
    expect("toStore" in saved && saved.toStore).toMatchObject({ match_threshold: 60, resume_view: "profile" });
    const refused = saveSection(null, {}, sectionRequest("scoring", { ...fields, resume_view: editedField("everything") }));
    expect("problems" in refused && refused.problems.map((problem) => problem.field)).toEqual(["resume_view"]);
});

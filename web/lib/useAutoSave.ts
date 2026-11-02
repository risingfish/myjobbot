import { startTransition } from "react";
import { sectionRequest } from "../../src/web/settingsForm.js";
import type { FieldName, SectionName } from "../../src/web/settingsSections.js";
import type { FieldView } from "../../src/web/settingsView.js";
import { useSectionSave } from "./useSectionSave.js";

type SectionFields = Partial<Record<FieldName, FieldView<unknown>>>;

/** Saves one Settings section as soon as one of its fields changes, so the section needs no Save button; while a save runs, the last one's result is hidden. */
export function useAutoSave(section: SectionName) {
    const { result, save, saving } = useSectionSave();
    const autosave = (fields: SectionFields) => startTransition(() => save(sectionRequest(section, fields)));
    return { result: saving ? null : result, saving, autosave };
}

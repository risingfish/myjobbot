import { useActionState, useState } from "react";
import type { SaveResult } from "../../src/web/settingsSave.js";
import { saveSettingsSection } from "./settingsActions.js";

/** Saves one Settings section through the server action, hiding the last result once the owner edits again, so a problem never points at a row that has moved. */
export function useSectionSave() {
    const [result, save, saving] = useActionState<SaveResult | null, unknown>(saveSettingsSection, null);
    const [outdated, setOutdated] = useState<SaveResult | null>(null);
    const edited = <T,>(set: (value: T) => void) => (value: T) => {
        setOutdated(result);
        set(value);
    };
    return { result: result === outdated ? null : result, save, saving, edited };
}

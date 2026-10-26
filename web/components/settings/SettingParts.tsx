import type { ReactNode } from "react";
import type { Problem } from "../../../src/web/settingsProblems.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView } from "../../../src/web/settingsView.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";

interface SettingProps {
    label: string;
    field: FieldView<unknown>;
    onReset: () => void;
    children: ReactNode;
}

/** Renders one editable setting under its label, saying when it takes its default and offering to reset it when it doesn't. */
export function Setting({ label, field, onReset, children }: SettingProps) {
    return (
        <section className="setting">
            <h5>
                {label}
                {field.isDefault && <small className="note"> (default)</small>}
                {!field.isDefault && (
                    <button type="button" className="reset" aria-label={`Reset ${label} to default`} onClick={onReset}>
                        Reset to default
                    </button>
                )}
            </h5>
            {children}
        </section>
    );
}

/** Lists the problems a refused save placed on one field and row, or at the section's top when both are null. */
export function Problems({ result, field, entry = null }: { result: SaveResult | null; field: string | null; entry?: number | null }) {
    const problems = result !== null && "problems" in result ? result.problems.filter((problem: Problem) => problem.field === field && problem.entry === entry) : [];
    if (problems.length === 0) return null;
    return (
        <ul role="alert" className="problems">
            {problems.map((problem, index) => (
                <li key={`${index}-${problem.message}`}>{problem.message}</li>
            ))}
        </ul>
    );
}

/** Renders a section's Save button, with whether its last save was stored, refused at the top, or couldn't run. */
export function SaveBar({ section, result, saving }: { section: string; result: SaveResult | null; saving: boolean }) {
    return (
        <footer>
            <Problems result={result} field={null} />
            <button disabled={saving} aria-label={`Save ${section}`}>
                Save
            </button>
            {result?.ok === true && <small className="note"> Saved</small>}
            <SaveFailedNote status={result !== null && "failed" in result ? "failed" : "idle"} />
        </footer>
    );
}

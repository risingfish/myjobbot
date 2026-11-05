import type { ReactNode } from "react";
import type { Problem } from "../../../src/web/settingsProblems.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";

/** Renders one editable setting under its label. */
export function Setting({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="setting">
            <h5>{label}</h5>
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

/** Says how a section's automatic save went: saving, stored, refused at the top, or couldn't run. */
export function SaveStatus({ result, saving }: { result: SaveResult | null; saving: boolean }) {
    return (
        <footer className="save-status" aria-live="polite">
            <Problems result={result} field={null} />
            {saving && <small className="note">Saving…</small>}
            {result?.ok === true && <small className="note saved">Saved</small>}
            <SaveFailedNote status={result !== null && "failed" in result ? "failed" : "idle"} />
        </footer>
    );
}

/** Renders a group of settings as a Pico card headed by the group's name. */
export function SettingCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <article>
            <header>{title}</header>
            {children}
        </article>
    );
}

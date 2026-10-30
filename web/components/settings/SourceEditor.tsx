"use client";

import { useActionState, useState } from "react";
import type { TestOutcome } from "../../../src/sources/testFetch.js";
import type { SourceSaveResult } from "../../../src/web/saveSource.js";
import { sourceFormView, type FieldValues, type SourceChoice, type SourceDraft, type SourceFormView } from "../../../src/web/sourceForm.js";
import { saveSource } from "../../lib/sourceActions.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";

interface SourceEditorProps {
    choice: SourceChoice;
    draft: SourceDraft;
    onClose: () => void;
}

type ShownField = SourceFormView["fields"][number];

/** Renders a source's form, its name then its module's fields, saving and testing it on Save, with each problem beside its field. */
export function SourceEditor({ choice, draft, onClose }: SourceEditorProps) {
    const [name, setName] = useState(draft.name);
    const [values, setValues] = useState<FieldValues>(draft.values);
    const [result, save, saving] = useActionState<SourceSaveResult | null, unknown>(saveSource, null);
    if (result?.ok === true) return <SavedNote test={result.test} onClose={onClose} />;
    const view = sourceFormView(choice, { ...draft, name, values }, result !== null && "problems" in result ? result.problems : []);
    return (
        <form aria-label={`${choice.name} source`} action={() => save({ id: draft.id, module: draft.module, name, values })}>
            <h5>{draft.id === null ? `New ${choice.name} source` : `Edit ${draft.name}`}</h5>
            <Messages list={view.top} />
            <SourceFields view={view} onName={setName} onValue={(field, value) => setValues({ ...values, [field]: value })} />
            <button disabled={saving}>Save</button>{" "}
            <button type="button" onClick={onClose}>
                Cancel
            </button>
            <SaveFailedNote status={result !== null && "failed" in result ? "failed" : "idle"} />
        </form>
    );
}

/** Renders a source's name and then each of its module's fields, each with the problems placed on it. */
function SourceFields({ view, onName, onValue }: { view: SourceFormView; onName: (name: string) => void; onValue: (field: string, value: string | boolean) => void }) {
    return (
        <>
            <label>
                Name <input value={view.name.value} onChange={(event) => onName(event.target.value)} />
            </label>
            <Messages list={view.name.problems} />
            {view.fields.map((shown) => (
                <FieldInput key={shown.field.name} shown={shown} onChange={(value) => onValue(shown.field.name, value)} />
            ))}
        </>
    );
}

/** Renders one of a module's fields as its input under its label, with the problems placed on it. */
function FieldInput({ shown, onChange }: { shown: ShownField; onChange: (value: string | boolean) => void }) {
    const { field, value } = shown;
    const text = <input value={String(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />;
    const choices = (
        <select value={String(value)} onChange={(event) => onChange(event.target.value)}>
            {(field.options ?? []).map((option) => (
                <option key={option}>{option}</option>
            ))}
        </select>
    );
    const box = <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />;
    return (
        <div className="setting">
            <label>
                {field.label} {field.input === "checkbox" ? box : field.input === "select" ? choices : text}
            </label>
            <Messages list={shown.problems} />
        </div>
    );
}

/** Lists the problems a refused save placed in one spot. */
function Messages({ list }: { list: string[] }) {
    if (list.length === 0) return null;
    return (
        <ul role="alert" className="problems">
            {list.map((message) => (
                <li key={message}>{message}</li>
            ))}
        </ul>
    );
}

/** Says a source was saved and how its test fetch went, with a button to close the form. */
function SavedNote({ test, onClose }: { test: TestOutcome; onClose: () => void }) {
    const said = test.ok ? `Saved. Test found ${test.jobs} job${test.jobs === 1 ? "" : "s"}.` : `Saved, but its test fetch failed: ${test.reason}. It will be tried again on the next run.`;
    return (
        <p role="status">
            {said}{" "}
            <button type="button" onClick={onClose}>
                Close
            </button>
        </p>
    );
}

import type { SourceField } from "../sources/module.js";
import type { Problem } from "./settingsProblems.js";

export type FieldValues = Record<string, string | boolean>;

export interface SourceDraft {
    id: number | null;
    module: string;
    name: string;
    values: FieldValues;
}

export interface SourceChoice {
    id: string;
    name: string;
    description: string;
    fields: SourceField[];
    unavailable: string | null;
}

interface ShownField {
    field: SourceField;
    value: string | boolean;
    problems: string[];
}

export interface SourceFormView {
    name: { value: string; problems: string[] };
    fields: ShownField[];
    top: string[];
}

export const NAME_FIELD = "name";

/** Shows a module's form for a draft: its name, then each of its fields with its value, each with the problems a refused save placed on it, and the rest at the top. */
export function sourceFormView(choice: SourceChoice, draft: SourceDraft, problems: Problem[]): SourceFormView {
    const on = (field: string) => problems.filter((problem) => problem.field === field).map((problem) => problem.message);
    const placed = new Set([NAME_FIELD, ...choice.fields.map((field) => field.name)]);
    const fields = choice.fields.map((field) => ({ field, value: draft.values[field.name] ?? emptyValue(field), problems: on(field.name) }));
    const top = problems.filter((problem) => problem.field === null || !placed.has(problem.field)).map((problem) => problem.message);
    return { name: { value: draft.name, problems: on(NAME_FIELD) }, fields, top };
}

/** Turns a source's stored fields into the values its form edits. */
export function paramValues(fields: readonly SourceField[], params: unknown): FieldValues {
    const stored = typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
    return Object.fromEntries(fields.map((field) => [field.name, formValue(field, stored[field.name])]));
}

/** Turns a form's values into a module's fields, leaving out an optional field left blank so its default applies. */
export function fieldParams(fields: readonly SourceField[], values: FieldValues): Record<string, unknown> {
    const entries = fields.map((field) => [field.name, paramValue(field, values[field.name])] as const);
    return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

/** Gives the value an empty form shows for a field. */
function emptyValue(field: SourceField): string | boolean {
    return field.input === "checkbox" ? false : "";
}

/** Shows one stored field's value in its form input. */
function formValue(field: SourceField, stored: unknown): string | boolean {
    if (field.input === "checkbox") return stored === true;
    return typeof stored === "string" || typeof stored === "number" ? String(stored) : "";
}

/** Reads one form value as a field, or undefined for an optional text left blank. */
function paramValue(field: SourceField, value: string | boolean | undefined): unknown {
    if (field.input === "checkbox") return value === true;
    const text = typeof value === "string" ? value.trim() : "";
    return text === "" && field.optional === true ? undefined : text;
}

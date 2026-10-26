import type { z } from "zod";
import type { SaveRequest } from "./settingsForm.js";
import { fieldsOf, type FieldName } from "./settingsSections.js";

export interface Problem {
    field: string | null;
    entry: number | null;
    message: string;
}

const REPEATED_TERM = "this term is already boosted above";

/** Places each reason a save was refused beside its field and row, or at the top of the saved section when it names no field of that section. */
export function sectionProblems(issues: z.core.$ZodIssue[], request: SaveRequest): Problem[] {
    return issues.flatMap((issue) => reasonsOf(issue).map((message) => ({ ...placeOf(issue.path, request), message })));
}

/** Refuses a boost term listed twice, on each repeat's row, instead of letting the map keep only one. */
export function repeatedBoosts(request: SaveRequest): Problem[] {
    const terms = boostRows(request).map(([term]) => String(term));
    return terms.flatMap((term, index) => (terms.indexOf(term) < index ? [{ field: "title_boosts", entry: index, message: REPEATED_TERM }] : []));
}

/** Gives an issue's reasons, one per nested reason for a bad record key. */
function reasonsOf(issue: z.core.$ZodIssue): string[] {
    return issue.code === "invalid_key" ? issue.issues.map((inner) => inner.message) : [issue.message];
}

/** Finds the field and row an issue's path points at, by the longest of the section's check paths it starts with. */
function placeOf(path: PropertyKey[], request: SaveRequest): Omit<Problem, "message"> {
    const matches = fieldsOf(request.section).filter((field) => field.check.every((key, index) => path[index] === key));
    const field = matches.sort((a, b) => b.check.length - a.check.length)[0];
    if (field === undefined) return { field: null, entry: null };
    return { field: field.name, entry: entryOf(field.name, path[field.check.length], request) };
}

/** Turns the path step after a field into its row: a list index, or a boost term's position in the submitted rows. */
function entryOf(name: FieldName, step: PropertyKey | undefined, request: SaveRequest): number | null {
    if (typeof step === "number") return step;
    if (name !== "title_boosts" || typeof step !== "string") return null;
    const index = boostRows(request).findIndex(([term]) => String(term) === step);
    return index === -1 ? null : index;
}

/** Reads the boost rows a request sends, if it sends any. */
function boostRows(request: SaveRequest): unknown[][] {
    const edit = request.edits.title_boosts;
    return edit?.kind === "value" && Array.isArray(edit.value) ? edit.value.filter(Array.isArray) : [];
}

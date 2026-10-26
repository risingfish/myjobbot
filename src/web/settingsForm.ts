import { z } from "zod";
import { fieldsOf, SECTION_NAMES, type FieldName, type SectionName } from "./settingsSections.js";
import type { FieldView } from "./settingsView.js";

const anything = z.unknown();
const termList = z.array(anything);

const ROW_SHAPES: Record<FieldName, z.ZodType> = {
    companies: z.array(z.strictObject({ name: anything, ats: anything, slug: anything }).partial()),
    searches: z.array(z.strictObject({ name: anything, query: anything, remote_only: anything, country: anything }).partial()),
    preferences: anything,
    match_threshold: anything,
    title_boosts: z.array(z.tuple([anything, anything])),
    include: termList,
    exclude: termList,
    extra_exclude: termList,
    exclude_companies: termList,
    exclude_publishers: termList,
};

const fieldEdit = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("default") }), z.strictObject({ kind: z.literal("value"), value: anything })]);

type FieldEdit = z.infer<typeof fieldEdit>;

export const saveRequest = z.strictObject({ section: z.enum(SECTION_NAMES), edits: z.record(z.string(), fieldEdit) }).refine(holdsSectionFields);

export type SaveRequest = z.infer<typeof saveRequest>;

/** Reports whether a request's edits are exactly its section's fields, each a default or a value of that field's shape. */
function holdsSectionFields({ section, edits }: { section: SectionName; edits: Record<string, FieldEdit> }): boolean {
    const names = fieldsOf(section).map((field) => field.name);
    if (Object.keys(edits).length !== names.length) return false;
    return names.every((name) => {
        const edit = edits[name];
        return edit !== undefined && (edit.kind === "default" || ROW_SHAPES[name].safeParse(edit.value).success);
    });
}

/** Adds a row to a list field, which stops it taking its default. */
export function addRow<T>(field: FieldView<T[]>, row: T): FieldView<T[]> {
    return { value: [...field.value, row], isDefault: false };
}

/** Removes the row at an index from a list field. */
export function removeRow<T>(field: FieldView<T[]>, index: number): FieldView<T[]> {
    return { value: field.value.filter((_row, at) => at !== index), isDefault: false };
}

/** Replaces the row at an index in a list field. */
export function updateRow<T>(field: FieldView<T[]>, index: number, row: T): FieldView<T[]> {
    return { value: field.value.map((current, at) => (at === index ? row : current)), isDefault: false };
}

/** Puts a field back to its default, marked, so the next save unsets it. */
export function resetField<T>(defaultValue: T): FieldView<T> {
    return { value: defaultValue, isDefault: true };
}

/** Gives a field the value the owner typed, which stops it taking its default. */
export function editedField<T>(value: T): FieldView<T> {
    return { value, isDefault: false };
}

/** Turns a section's fields into its save request: a field still at its default is sent as default, so it stays unset, and every other field as its value. */
export function sectionRequest(section: SectionName, fields: Partial<Record<FieldName, FieldView<unknown>>>): SaveRequest {
    const edits = fieldsOf(section).map(({ name }): [string, FieldEdit] => {
        const field = fields[name];
        return [name, field === undefined || field.isDefault ? { kind: "default" } : { kind: "value", value: field.value }];
    });
    return { section, edits: Object.fromEntries(edits) };
}

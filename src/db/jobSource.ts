export type JobSource = string | { id: number; name: string };

/** Splits where jobs came from into the label they are shown under and the saved source they link to, if any. */
export function sourceParts(source: JobSource): { label: string; id: number | null } {
    return typeof source === "string" ? { label: source, id: null } : { label: source.name, id: source.id };
}

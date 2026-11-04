import { z } from "zod";
import { rescoreSystemTemplate } from "../rescore/prompt.js";
import type { Parsed } from "./format.js";
import { contentId } from "./ids.js";

const CURRENT = 1;
const OPEN = "---\n";
const CLOSE = "\n---\n";
const PAIR = /^([A-Za-z]+): (.*)$/;
const MARKER = /\{([a-z_]+)\}/g;
const REQUIRED = ["data", "threshold", "preferences"];
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CODE = "code";

const header = z.strictObject({ schema: z.literal(CURRENT), exportedAt: z.iso.datetime(), exportedFrom: z.string().regex(/^[0-9a-f]{16}$/), gitCommit: z.string().min(1).nullable() });

export interface Variant {
    header: z.infer<typeof header>;
    text: string;
}

/** Reads a variant file: its versioned header, then its template text exactly as written. */
export function parseVariant(raw: string): Parsed<Variant> {
    const split = splitHeader(raw);
    if ("problem" in split) return { ok: false, problem: split.problem };
    if (split.fields.schema !== String(CURRENT)) return { ok: false, problem: `needs upgrade (schema ${split.fields.schema ?? "?"})` };
    const parsed = header.safeParse({ ...split.fields, schema: CURRENT, gitCommit: split.fields.gitCommit === "null" ? null : split.fields.gitCommit });
    if (!parsed.success) return { ok: false, problem: `${parsed.error.issues[0]?.path.join(".") || "(root)"}: ${parsed.error.issues[0]?.code ?? "invalid"}` };
    return { ok: true, value: { header: parsed.data, text: split.body } };
}

/** Separates a variant file's header lines, read as keys and values, from its body, or names what is wrong with the header. */
function splitHeader(raw: string): { fields: Record<string, string>; body: string } | { problem: string } {
    const end = raw.indexOf(CLOSE);
    if (!raw.startsWith(OPEN) || end === -1) return { problem: "no closing --- after the header" };
    const fields = headerFields(raw.slice(OPEN.length, end).split("\n"));
    return typeof fields === "string" ? { problem: fields } : { fields, body: raw.slice(end + CLOSE.length) };
}

/** Writes a variant file: the header's lines between --- lines, then the text as it is. */
export function formatVariant({ header: fields, text }: Variant): string {
    return `${OPEN}schema: ${fields.schema}\nexportedAt: ${fields.exportedAt}\nexportedFrom: ${fields.exportedFrom}\ngitCommit: ${fields.gitCommit ?? "null"}${CLOSE}${text}`;
}

/** Names what stops a template from being run: a missing data sentence, threshold or preferences marker, or a marker the run doesn't fill. */
export function markerProblems(text: string): string[] {
    const found = new Set([...text.matchAll(MARKER)].map((match) => match[1] ?? ""));
    const missing = REQUIRED.filter((name) => !found.has(name)).map((name) => `missing {${name}}`);
    return [...missing, ...[...found].filter((name) => !REQUIRED.includes(name)).map((name) => `unknown marker {${name}}`)];
}

/** Says why a name can't be a variant's, or null when it can. */
export function variantName(name: string): string | null {
    if (name === CODE) return '"code" is kept for the code\'s prompt';
    return NAME.test(name) ? null : "variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40";
}

/** Names the version of the code's prompt template, so a variant can tell whether the code has changed since it was exported. */
export function codeTemplateId(): string {
    return contentId({ template: rescoreSystemTemplate() });
}

/** Splits the header's lines into keys and values, or names the first line that isn't `key: value`. */
function headerFields(lines: string[]): Record<string, string> | string {
    const fields: Record<string, string> = {};
    for (const [index, line] of lines.entries()) {
        const match = PAIR.exec(line);
        if (match === null) return `header line ${index + 1} isn't key: value`;
        fields[match[1] ?? ""] = match[2] ?? "";
    }
    return fields;
}

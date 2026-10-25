import type { z } from "zod";
import { describeError } from "../errors.js";
import type { RawSearchSettings } from "../db/searchSettingsStore.js";
import { parseJson } from "./parse.js";
import { fileConfigSchema } from "./schema.js";
import { isRawObject, mergeSettings, splitSettings } from "./searchSettings.js";

type ImportCheck = { ok: true; settings: RawSearchSettings } | { ok: false; messages: string[] };

/** Checks an edited settings file as a whole against the current runtime settings, returning the search settings to store or every reason it is refused. */
export function checkImport(text: string, name: string, runtime: unknown): ImportCheck {
    let raw: unknown;
    try {
        raw = parseJson(text, name);
    } catch (error) {
        return { ok: false, messages: [describeError(error)] };
    }
    if (!isRawObject(raw)) return { ok: false, messages: [`${name} must hold a JSON object of search settings`] };
    const { search, runtime: misplaced } = splitSettings(raw);
    const names = misplacedNames(misplaced);
    if (names.length > 0) return { ok: false, messages: names.map((key) => `${key} belongs in config.json, not in imported settings`) };
    const result = fileConfigSchema.safeParse(mergeSettings(runtime, search));
    return result.success ? { ok: true, settings: search } : { ok: false, messages: result.error.issues.flatMap(issueMessages) };
}

/** Turns stored search settings into the file an export writes, in config.json's shape; nothing stored gives an empty object. */
export function exportDocument(stored: RawSearchSettings | null): unknown {
    return stored === null ? {} : mergeSettings({}, stored);
}

/** Names the keys an imported file holds that are not search settings, as config.json names them. */
function misplacedNames(runtime: unknown): string[] {
    if (!isRawObject(runtime)) return [];
    return Object.entries(runtime).flatMap(([key, value]) => (key === "jsearch" && isRawObject(value) ? Object.keys(value).map((inner) => `jsearch.${inner}`) : [key]));
}

/** Words one rule failure with where in the file it is, giving a bad record key's own reasons as loading config.json does. */
function issueMessages(issue: z.core.$ZodIssue): string[] {
    const where = issue.path.length === 0 ? "" : `${issue.path.join(".")}: `;
    const reasons = issue.code === "invalid_key" ? issue.issues.map((inner) => inner.message) : [issue.message];
    return reasons.map((reason) => `${where}${reason}`);
}

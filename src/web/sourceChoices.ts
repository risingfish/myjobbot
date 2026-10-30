import type { Requirement, SourceModule } from "../sources/module.js";
import { MODULES } from "../sources/registry.js";
import type { SourceChoice } from "./sourceForm.js";

export type Met = Record<Requirement, boolean>;

const NEEDS: Record<Requirement, string> = { jsearch_key: "Needs JSEARCH_API_KEY in .env", gmail: "Needs Gmail connected" };

/** Lists the source types the owner can add, as plain data the browser can hold: each module's id, name, description and fields, and why it can't be used yet. */
export function sourceChoices(met: Met): SourceChoice[] {
    return MODULES.filter((module) => module.scope !== "account").map((module) => ({ id: module.id, name: module.name, description: module.description, fields: [...module.fields], unavailable: unmetNeed(module, met) }));
}

/** Says what a module needs that isn't set up, or null when it can be used. */
export function unmetNeed(module: SourceModule<unknown>, met: Met): string | null {
    const missing = module.requires.find((requirement) => !met[requirement]);
    return missing === undefined ? null : NEEDS[missing];
}

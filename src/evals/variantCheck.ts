import type { ExperimentFiles } from "./experimentFiles.js";
import { codeTemplateId, markerProblems, variantName, type Variant } from "./variant.js";

export type Loaded = { ok: true; variant: Variant; drifted: boolean } | { ok: false; refusal: string };

/** Loads a variant to run with, refusing one that is missing, misnamed, unreadable or drops a marker, and noting whether the code's prompt changed since its export. */
export async function loadVariant(experiments: ExperimentFiles, name: string): Promise<Loaded> {
    const badName = variantName(name);
    if (badName !== null) return refused(name, [badName]);
    const parsed = await experiments.variant(name);
    if (parsed === null) return refused(name, ["no such variant"]);
    if (!parsed.ok) return refused(name, [parsed.problem]);
    const problems = markerProblems(parsed.value.text);
    if (problems.length > 0) return refused(name, problems);
    return { ok: true, variant: parsed.value, drifted: parsed.value.header.exportedFrom !== codeTemplateId() };
}

/** Writes the line that refuses a variant, naming each problem. */
function refused(name: string, problems: string[]): Loaded {
    return { ok: false, refusal: `refused variant ${name}: ${problems.join(", ")}` };
}

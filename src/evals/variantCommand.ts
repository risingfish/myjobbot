import { parseArgs } from "node:util";
import { rescoreSystemTemplate } from "../rescore/prompt.js";
import type { ExperimentFiles } from "./experimentFiles.js";
import { lineDiff } from "./lineDiff.js";
import { codeTemplateId, variantName } from "./variant.js";

const USAGE = "usage: myjobbot eval prompt export <name> [--fresh] | diff <a|code> <b|code>";

export interface PromptDeps {
    experiments: ExperimentFiles;
    now: () => Date;
    gitCommit: () => string | null;
    print: (line: string) => void;
}

/** Runs one `eval prompt` subcommand: export today's prompt as a variant, or show what differs between two. */
export async function promptCommand(args: string[], deps: PromptDeps): Promise<number> {
    const [name = "", ...rest] = args;
    if (name === "export") return exportCommand(rest, deps);
    if (name === "diff") return diffCommand(rest, deps);
    return printed(deps, [USAGE], 2);
}

/** Writes the code's prompt template as a named variant, leaving one already there alone unless asked to replace it. */
async function exportCommand(args: string[], deps: PromptDeps): Promise<number> {
    const flags = exportFlags(args);
    const [name] = flags?.positionals ?? [];
    if (flags === null || name === undefined || flags.positionals.length > 1) return printed(deps, [USAGE], 2);
    const refused = variantName(name);
    if (refused !== null) return printed(deps, [`refused ${name}: ${refused}`], 1);
    if (flags.values.fresh !== true && (await deps.experiments.hasVariant(name))) return printed(deps, [`exists: ${name}`], 0);
    const text = rescoreSystemTemplate();
    const header = { schema: 1 as const, exportedAt: deps.now().toISOString(), exportedFrom: codeTemplateId(), gitCommit: deps.gitCommit() };
    await deps.experiments.writeVariant(name, { header, text });
    return printed(deps, [`exported variant ${name} · ${text.split("\n").length} lines · from prompt ${header.exportedFrom}`], 0);
}

/** Parses the export command's name and flag, or null when they don't fit its form. */
function exportFlags(args: string[]) {
    try {
        return parseArgs({ args, allowPositionals: true, options: { fresh: { type: "boolean" } } });
    } catch {
        return null;
    }
}

/** Shows the lines that differ between two variants, or a variant and the code's prompt. */
async function diffCommand(args: string[], deps: PromptDeps): Promise<number> {
    if (args.length !== 2) return printed(deps, [USAGE], 2);
    const [first = "", second = ""] = args;
    const texts = await Promise.all([templateOf(first, deps.experiments), templateOf(second, deps.experiments)]);
    const missing = texts.flatMap((text, index) => (typeof text === "string" ? [] : [`refused ${args[index]}: ${text.problem}`]));
    if (missing.length > 0) return printed(deps, missing, 1);
    const changed = lineDiff(String(texts[0]), String(texts[1]));
    return printed(deps, [`--- ${first}`, `+++ ${second}`, ...(changed.length === 0 ? ["no differences"] : changed)], 0);
}

/** Gives the template a name stands for: the code's prompt for "code", else the named variant's text. */
async function templateOf(name: string, experiments: ExperimentFiles): Promise<string | { problem: string }> {
    if (name === "code") return rescoreSystemTemplate();
    const parsed = await experiments.variant(name);
    if (parsed === null) return { problem: "no such variant" };
    return parsed.ok ? parsed.value.text : { problem: parsed.problem };
}

/** Prints lines and gives back an exit code. */
function printed(deps: PromptDeps, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}

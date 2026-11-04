import { expect, test } from "vitest";
import { ExperimentFiles } from "../src/evals/experimentFiles.js";
import { promptCommand } from "../src/evals/variantCommand.js";
import { codeTemplateId } from "../src/evals/variant.js";
import { rescoreSystemTemplate } from "../src/rescore/prompt.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";

function setup(seed: Record<string, string> = {}) {
    const { port, files } = memoryFilePort(seed);
    const lines: string[] = [];
    const deps = { experiments: new ExperimentFiles(port), now: () => new Date("2026-11-04T18:00:00.000Z"), gitCommit: () => "25778fd", print: (line: string) => void lines.push(line) };
    return { files, lines, run: (args: string[]) => promptCommand(args, deps) };
}

test("export writes today's prompt template as a variant, its header naming the prompt version it came from, and it differs from the code in nothing", async () => {
    const { files, lines, run } = setup();
    expect(await run(["export", "baseline"])).toBe(0);
    const written = files.get("evals/variants/baseline.md") ?? "";
    expect([written.endsWith(`---\n${rescoreSystemTemplate()}`), written.includes(`exportedFrom: ${codeTemplateId()}`), written.includes("gitCommit: 25778fd")]).toEqual([true, true, true]);
    expect(lines).toEqual([`exported variant baseline · ${rescoreSystemTemplate().split("\n").length} lines · from prompt ${codeTemplateId()}`]);
    expect([await run(["diff", "code", "baseline"]), lines.slice(1), await run(["diff", "baseline", "missing"]), lines.at(-1)]).toEqual([0, ["--- code", "+++ baseline", "no differences"], 1, "refused missing: no such variant"]);
});

test("export leaves an existing variant alone unless asked to replace it, and refuses a bad name", async () => {
    const { files, lines, run } = setup({ "evals/variants/baseline.md": "my edits" });
    expect([await run(["export", "baseline"]), files.get("evals/variants/baseline.md"), await run(["export", "baseline", "--fresh"]), files.get("evals/variants/baseline.md") === "my edits", await run(["export", "Big"])]).toEqual([0, "my edits", 0, false, 1]);
    expect([lines[0], lines.at(-1)]).toEqual(["exists: baseline", "refused Big: variant names are a-z, 0-9 and -, starting with a letter or digit, up to 40"]);
});

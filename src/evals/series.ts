import { parseArgs } from "node:util";
import { parseFile } from "./format.js";
import { runId } from "./ids.js";
import { executeRun, type RunDeps } from "./runCases.js";
import type { Series, SeriesRun } from "./seriesFormat.js";
import { loadVariant } from "./variantCheck.js";

const TEST = /^([a-z0-9][a-z0-9-]{0,39})=([^@]+)(?:@(.+))?$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
const CODE = "code";

type FileDeps = Pick<RunDeps, "files" | "now" | "print">;

/** Saves a series of tests to run over the same cases and repeats, leaving one already saved alone unless asked to replace it. */
export async function saveSeries(args: string[], deps: FileDeps): Promise<number> {
    const read = readSaveArgs(args);
    if (typeof read === "string") return printed(deps, [read], read.startsWith("usage") ? 2 : 1);
    const existing = (await deps.files.series()).items.some((each) => each.id === read.name);
    if (existing && !read.fresh) return printed(deps, [`exists: ${read.name}`], 0);
    const parsed = parseFile("series", { schema: 1, tags: read.tags, cases: read.cases, repeats: read.repeats, tests: read.tests, createdAt: deps.now().toISOString() });
    if (!parsed.ok) return printed(deps, [`refused series ${read.name}: ${parsed.problem}`], 1);
    await deps.files.writeSeries(read.name, parsed.value);
    const scope = read.tags.length > 0 ? `tag ${read.tags.join(", ")}` : read.cases.length > 0 ? `${read.cases.length} cases` : "every case";
    return printed(deps, [`saved series ${read.name} · ${read.tests.length} tests · ${scope} × ${read.repeats}`], 0);
}

/** Runs every test of a saved series in turn, each as its own run, after checking all their variants, recording which run each test made. */
export async function runSeries(name: string, deps: RunDeps): Promise<number> {
    const series = (await deps.files.series()).items.find((each) => each.id === name)?.value;
    if (series === undefined) return printed(deps, [`no series ${name}`], 1);
    const refusals = await refusalsOf(series, deps);
    if (refusals.length > 0)
        return printed(
            deps,
            refusals.map((refusal) => `refused series ${name}: ${refusal}`),
            1,
        );
    const record: SeriesRun = { schema: 1, id: runId(deps.now(), deps.random), series: name, startedAt: deps.now().toISOString(), endedAt: null, runs: Object.fromEntries(series.tests.map((test) => [test.label, null])) };
    await deps.files.writeSeriesRun(record);
    deps.print(`series ${name} ${record.id}: ${series.tests.length} tests`);
    await runTests(series, record, deps);
    await deps.files.writeSeriesRun({ ...record, endedAt: deps.now().toISOString() });
    return printed(deps, [`series ${name} done: report with \`eval series report ${name}\``], 0);
}

/** Runs a series' tests one after another, as ordinary runs, saving after each which run it made. */
async function runTests(series: Series, record: SeriesRun, deps: RunDeps): Promise<void> {
    for (const test of series.tests) {
        deps.print(`== ${test.label} (${test.variant ?? CODE}${test.model === null ? "" : ` on ${test.model}`})`);
        const made = await executeRun({ tags: series.tags, ids: series.cases, repeats: series.repeats, model: test.model ?? undefined, variant: test.variant }, deps);
        record.runs[test.label] = made.run?.id ?? null;
        await deps.files.writeSeriesRun(record);
    }
}

/** Checks every test's variant before anything runs, naming each test that would be refused. */
async function refusalsOf(series: Series, deps: RunDeps): Promise<string[]> {
    const checked = await Promise.all(series.tests.map(async (test) => ({ test, loaded: test.variant === null ? null : await loadVariant(deps.experiments, test.variant) })));
    return checked.flatMap(({ test, loaded }) => (loaded === null || loaded.ok ? [] : [`test ${test.label}: ${loaded.refusal}`]));
}

/** Reads the save command's flags and checks its name and tests, or says what is wrong with them. */
function readSaveArgs(args: string[]) {
    const flags = saveFlags(args);
    if (flags === null) return SERIES_USAGE;
    const [name] = flags.positionals;
    const texts = flags.values.test ?? [];
    if (name === undefined || flags.positionals.length > 1 || texts.length === 0) return SERIES_USAGE;
    const tests = testsOf(name, texts);
    if (typeof tests === "string") return tests;
    return { name, tags: flags.values.tag ?? [], cases: flags.values.case ?? [], repeats: Number(flags.values.repeats ?? "1"), tests, fresh: flags.values.fresh === true };
}

/** Reads a series' tests, or names the series or the test that can't be saved. */
function testsOf(name: string, texts: string[]): string | Array<NonNullable<ReturnType<typeof testOf>>> {
    if (!NAME.test(name)) return `refused series ${name}: series names are a-z, 0-9 and -, up to 40`;
    const tests = texts.map(testOf);
    const bad = texts.find((_, index) => tests[index] === null);
    return bad === undefined ? tests.filter((test) => test !== null) : `refused series ${name}: test ${bad} isn't <label>=<variant|code>[@model]`;
}

/** Parses the save command's flags, or null when they don't fit its form. */
function saveFlags(args: string[]) {
    try {
        return parseArgs({ args, allowPositionals: true, options: { tag: { type: "string", multiple: true }, case: { type: "string", multiple: true }, repeats: { type: "string" }, test: { type: "string", multiple: true }, fresh: { type: "boolean" } } });
    } catch {
        return null;
    }
}

/** Reads one `<label>=<variant|code>[@model]` test, or null when it isn't one. */
function testOf(text: string): { label: string; variant: string | null; model: string | null } | null {
    const match = TEST.exec(text);
    if (match === null) return null;
    return { label: match[1] ?? "", variant: match[2] === CODE ? null : (match[2] ?? null), model: match[3] ?? null };
}

export const SERIES_USAGE = "usage: myjobbot eval series save <name> [--tag t]... [--case id]... [--repeats N] --test <label>=<variant|code>[@model]... [--fresh] | run <name> | report <name> [--run id]";

/** Prints lines and gives back an exit code. */
function printed(deps: Pick<RunDeps, "print">, lines: string[], code: number): number {
    for (const line of lines) deps.print(line);
    return code;
}

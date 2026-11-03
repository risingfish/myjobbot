import { parseFile, type EvalCase, type FileKind, type FileOf, type AnswerKey, type Parsed, type Profile, type Prompt, type Result, type Run } from "./format.js";
import type { FilePort } from "./filePort.js";

const ROOT = "evals";

export interface Bad {
    file: string;
    problem: string;
}

export interface Named<T> {
    id: string;
    value: T;
}

export interface Loaded<T> {
    items: T[];
    bad: Bad[];
}

/** Reads the eval files through a port, keeping every file that matches its format and naming each one that doesn't. */
export class EvalFiles {
    private readonly port: FilePort;

    /** Keeps the port the files are read through. */
    constructor(port: FilePort) {
        this.port = port;
    }

    /** Reads the stored profiles, named by their content ids. */
    profiles(): Promise<Loaded<Named<Profile>>> {
        return this.folder("profiles", "profile");
    }

    /** Reads the stored cases, each checked to carry its file's name as its id. */
    cases(): Promise<Loaded<Named<EvalCase>>> {
        return this.folder("cases", "case");
    }

    /** Reads the stored answer keys, named by the case they judge. */
    answerKeys(): Promise<Loaded<Named<AnswerKey>>> {
        return this.folder("answer_keys", "answer_key");
    }

    /** Reads the stored prompts, named by their content ids. */
    prompts(): Promise<Loaded<Named<Prompt>>> {
        return this.folder("prompts", "prompt");
    }

    /** Reads every run's record, each checked to carry its folder's name as its id. */
    async runs(): Promise<Loaded<Named<Run>>> {
        const loaded = await Promise.all((await this.port.list(`${ROOT}/runs`)).map((id) => this.one(`runs/${id}/run.json`, id, "run")));
        return gathered(loaded);
    }

    /** Reads one run's results, one per line, naming a bad line by its number. */
    async results(runId: string): Promise<Loaded<Result>> {
        const file = `runs/${runId}/results.jsonl`;
        const lines = ((await this.port.read(`${ROOT}/${file}`)) ?? "").split("\n");
        const parsed = lines.map((line, index) => ({ line: index + 1, parsed: line.trim() === "" ? null : parsedText(line, "result") }));
        const items = parsed.flatMap(({ parsed: each }) => (each?.ok ? [each.value] : []));
        const bad = parsed.flatMap(({ line, parsed: each }) => (each !== null && !each.ok ? [{ file: `${file}:${line}`, problem: each.problem }] : []));
        return { items, bad };
    }

    /** Stores a profile once, leaving one already stored as it is, since its name is its content. */
    async writeProfile(id: string, profile: Profile): Promise<void> {
        const file = `${ROOT}/profiles/${id}.json`;
        if ((await this.port.read(file)) === null) await this.atomic(file, profile);
    }

    /** Stores a case under its own id, replacing one already there. */
    writeCase(value: EvalCase): Promise<void> {
        return this.atomic(`${ROOT}/cases/${value.id}.json`, value);
    }

    /** Tells whether a case is stored under an id, whether or not it reads cleanly. */
    async hasCase(id: string): Promise<boolean> {
        return (await this.port.read(`${ROOT}/cases/${id}.json`)) !== null;
    }

    /** Writes a file whole or not at all: to a temporary name first, then renamed into place. */
    private async atomic(file: string, value: unknown): Promise<void> {
        await this.port.write(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
        await this.port.rename(`${file}.tmp`, file);
    }

    /** Reads every `.json` file in one folder as one kind. */
    private async folder<K extends FileKind>(dir: string, kind: K): Promise<Loaded<Named<FileOf<K>>>> {
        const names = (await this.port.list(`${ROOT}/${dir}`)).filter((name) => name.endsWith(".json"));
        return gathered(await Promise.all(names.map((name) => this.one(`${dir}/${name}`, name.slice(0, -".json".length), kind))));
    }

    /** Reads one file as one kind, refusing one whose own id differs from its name. */
    private async one<K extends FileKind>(file: string, id: string, kind: K): Promise<Named<FileOf<K>> | Bad> {
        const parsed = parsedText((await this.port.read(`${ROOT}/${file}`)) ?? "", kind);
        if (!parsed.ok) return { file, problem: parsed.problem };
        const own = (parsed.value as { id?: unknown }).id;
        return typeof own === "string" && own !== id ? { file, problem: `id ${own} doesn't match the file name` } : { id, value: parsed.value };
    }
}

/** Parses a file's text as JSON and then as its kind. */
function parsedText<K extends FileKind>(text: string, kind: K): Parsed<FileOf<K>> {
    try {
        return parseFile(kind, JSON.parse(text));
    } catch {
        return { ok: false, problem: "not valid JSON" };
    }
}

/** Splits read files into the good ones and the bad ones. */
function gathered<T>(loaded: Array<Named<T> | Bad>): Loaded<Named<T>> {
    return { items: loaded.filter((each): each is Named<T> => "value" in each), bad: loaded.filter((each): each is Bad => "problem" in each) };
}

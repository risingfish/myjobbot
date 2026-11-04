import type { Parsed } from "./format.js";
import type { Bad, Loaded, Named } from "./files.js";
import type { FilePort } from "./filePort.js";
import { formatVariant, parseVariant, variantName, type Variant } from "./variant.js";

const VARIANTS = "evals/variants";

/** Reads and writes the files of prompt experiments: variants, and the series that compare them. */
export class ExperimentFiles {
    private readonly port: FilePort;

    /** Keeps the port the files go through. */
    constructor(port: FilePort) {
        this.port = port;
    }

    /** Reads every variant, naming each file that doesn't read as one. */
    async variants(): Promise<Loaded<Named<Variant>>> {
        const names = (await this.port.list(VARIANTS)).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -".md".length));
        const read = await Promise.all(names.map(async (name) => ({ name, parsed: await this.variant(name) })));
        const items = read.flatMap(({ name, parsed }) => (parsed?.ok ? [{ id: name, value: parsed.value }] : []));
        const bad: Bad[] = read.flatMap(({ name, parsed }) => (parsed !== null && !parsed.ok ? [{ file: `variants/${name}.md`, problem: parsed.problem }] : []));
        return { items, bad };
    }

    /** Reads one variant by name, or null when there is none. */
    async variant(name: string): Promise<Parsed<Variant> | null> {
        if (variantName(name) !== null) return null;
        const raw = await this.port.read(`${VARIANTS}/${name}.md`);
        return raw === null ? null : parseVariant(raw);
    }

    /** Tells whether a variant file is stored under a name, whether or not it reads cleanly. */
    async hasVariant(name: string): Promise<boolean> {
        return (await this.port.read(`${VARIANTS}/${name}.md`)) !== null;
    }

    /** Stores a variant, replacing one of the same name. */
    writeVariant(name: string, variant: Variant): Promise<void> {
        return this.atomic(`${VARIANTS}/${name}.md`, formatVariant(variant));
    }

    /** Writes a file whole or not at all: to a temporary name first, then renamed into place. */
    private async atomic(file: string, text: string): Promise<void> {
        await this.port.write(`${file}.tmp`, text);
        await this.port.rename(`${file}.tmp`, file);
    }
}

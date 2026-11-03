import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { nodeFilePort } from "../../src/evals/filePort.js";

test("the node file port writes into new folders, appends, renames, lists and reads back, and a missing folder lists as empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "evals-"));
    try {
        const port = nodeFilePort(root);
        await port.write("evals/cases/a.json.tmp", "{}");
        await port.rename("evals/cases/a.json.tmp", "evals/cases/a.json");
        await port.append("evals/runs/r1/results.jsonl", "1\n");
        await port.append("evals/runs/r1/results.jsonl", "2\n");
        expect([await port.read("evals/cases/a.json"), await port.read("evals/runs/r1/results.jsonl"), await port.read("evals/cases/b.json"), await port.list("evals/cases"), await port.list("evals/runs"), await port.list("evals/labels"), await readdir(join(root, "evals/cases"))]).toEqual(["{}", "1\n2\n", null, ["a.json"], ["r1"], [], ["a.json"]]);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

import { expect, test } from "vitest";
import { EvalFiles } from "../src/evals/files.js";
import { evalCase, parsed, profile } from "./helpers/evalFixtures.js";
import { memoryFilePort } from "./helpers/memoryFilePort.js";

test("a case and a new profile are written through a temporary file, and a profile already stored is left alone", async () => {
    const { port, files, writes } = memoryFilePort({ "evals/profiles/p0.json": "kept" });
    const evals = new EvalFiles(port);
    await evals.writeProfile("p1", parsed("profile", profile()));
    await evals.writeProfile("p0", parsed("profile", profile()));
    await evals.writeCase(parsed("case", evalCase()));
    expect(writes).toEqual(["write evals/profiles/p1.json.tmp", "rename evals/profiles/p1.json.tmp evals/profiles/p1.json", "write evals/cases/greenhouse-4012345.json.tmp", "rename evals/cases/greenhouse-4012345.json.tmp evals/cases/greenhouse-4012345.json"]);
    expect([files.get("evals/profiles/p0.json"), (await evals.cases()).items.map((item) => item.id), await evals.hasCase("greenhouse-4012345"), await evals.hasCase("lever-1")]).toEqual(["kept", ["greenhouse-4012345"], true, false]);
});

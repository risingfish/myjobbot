import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

function copyProd(...args: string[]) {
    const run = spawnSync("bash", ["scripts/copy-prod.sh", ...args], { encoding: "utf8", input: "" });
    return { status: run.status, stderr: run.stderr };
}

test("copy-prod refuses any target but the two dev databases, before reading .env or the server", () => {
    for (const args of [[], ["myjobbot"], ["myjobbot_test"], ["myjobbot_test_alt"], ["myjobbot_dev", "--force"], ["myjobbot_dev", "--yes", "extra"]]) {
        expect(copyProd(...args)).toEqual({ status: 2, stderr: "usage: scripts/copy-prod.sh myjobbot_dev|myjobbot_dev_alt [--yes]\n" });
    }
});

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const SKIPPED = ["sessions", "email_tokens", "auth_challenges", "auth_attempts", "account_codes"];

function fakeServer(dir: string): void {
    const log = `${dir}/calls.log`;
    writeFileSync(`${dir}/bin/mysqldump`, `#!/usr/bin/env bash\necho "mysqldump $*" >> ${log}\n`, { mode: 0o755 });
    const mysql = [
        "#!/usr/bin/env bash",
        `echo "mysql $*" >> ${log}`,
        'case "$*" in',
        `  *"table_name IN"*) printf '%s\\n' ${SKIPPED.join(" ")} ;;`,
        "  *\"table_schema = 'myjobbot_dev'\"*) echo jobs ;;",
        "  *COUNT*) printf '25\\n12\\n019_session_details\\n' ;;",
        "  *) cat > /dev/null ;;",
        "esac",
        "",
    ].join("\n");
    writeFileSync(`${dir}/bin/mysql`, mysql, { mode: 0o755 });
}

function scratchCheckout(): string {
    const dir = mkdtempSync(join(tmpdir(), "copy-prod-"));
    mkdirSync(`${dir}/scripts`);
    mkdirSync(`${dir}/bin`);
    copyFileSync("scripts/copy-prod.sh", `${dir}/scripts/copy-prod.sh`);
    writeFileSync(`${dir}/.env`, "MYJOBBOT_DB_HOST=db.invalid\nMYJOBBOT_DB_USER=dev_user\nMYJOBBOT_DB_PASSWORD=dev-secret-1\nMYJOBBOT_COPY_DB_USER=reader\nMYJOBBOT_COPY_DB_PASSWORD=copy-secret-2\n");
    fakeServer(dir);
    return dir;
}

test("copy-prod copies no rows of the sign-ins, links, challenges, attempts and creation codes, only their empty tables, and puts no password in any argument", () => {
    const dir = scratchCheckout();
    const run = spawnSync("bash", [`${dir}/scripts/copy-prod.sh`, "myjobbot_dev", "--yes"], { encoding: "utf8", env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}` } });
    expect(run.status, run.stderr).toBe(0);
    const calls = readFileSync(`${dir}/calls.log`, "utf8").split("\n").filter((line) => line.startsWith("mysqldump") && !line.includes("--help"));
    const [main, empty] = calls;
    expect(calls).toHaveLength(2);
    expect((main?.match(/--ignore-table=myjobbot\.(\w+)/g) ?? []).map((flag) => flag.split(".")[1])).toEqual(SKIPPED);
    expect(main).not.toContain("--no-data");
    expect(empty).toContain("--no-data");
    expect(empty?.split(" ").slice(-SKIPPED.length)).toEqual(SKIPPED);
    expect(readFileSync(`${dir}/calls.log`, "utf8")).not.toMatch(/dev-secret-1|copy-secret-2/);
    expect(run.stdout).toContain("copied myjobbot into myjobbot_dev: 25 tables, 12 jobs, last step 019_session_details");
    rmSync(dir, { recursive: true, force: true });
});

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { storesFor, userOption } from "../src/cliUser.js";
import { memoryStores, type TestStores } from "./helpers/memoryStore.js";

const NOW = new Date().toISOString();

async function withSecond(): Promise<TestStores> {
    const stores = memoryStores();
    await stores.accounts.initOwner({ email: "owner@example.com", emailKey: "owner@example.com", passwordDigest: "digest" }, NOW);
    await stores.accountCodes.makeCode("code", 1, NOW);
    await stores.accounts.createAccount({ email: "Second@Example.com", emailKey: "second@example.com", name: "Second", passwordDigest: "digest" }, "code", NOW);
    return stores;
}

test("--user is taken out of the arguments, and no flag means user 1", async () => {
    expect([userOption(["greenhouse", "--user", "a@b.co", "1000"]), userOption(["--user=a@b.co"]), userOption(["greenhouse", "1000"])]).toEqual([
        { email: "a@b.co", rest: ["greenhouse", "1000"] },
        { email: "a@b.co", rest: [] },
        { email: undefined, rest: ["greenhouse", "1000"] },
    ]);
    expect(await storesFor(await withSecond(), undefined)).toMatchObject({ userId: 1 });
});

test("an unknown or malformed email is refused with a fixed line that never repeats it", async () => {
    const stores = await withSecond();
    expect([await storesFor(stores, "nobody@example.com"), await storesFor(stores, "not-an-address"), userOption(["--user"])]).toEqual([{ refused: "--user: no account with that email" }, { refused: "--user: not a valid address" }, { email: "", rest: [] }]);
});

test("the stores given are the named user's, found by the email as typed at sign-in, and every command that acts for a user takes them", async () => {
    expect(await storesFor(await withSecond(), " SECOND@example.com ")).toMatchObject({ userId: 2 });
    const callers = ["src/cli.ts", "src/evals/command.ts"].map((path) => readFileSync(path, "utf8").split("storesFor(").length - 1);
    expect(callers).toEqual([2, 2]);
});

test("with no --user and no user 1, a command is refused and told to name an email", async () => {
    expect(await storesFor(memoryStores(), undefined)).toEqual({ refused: "user 1 no longer exists; name an email with --user" });
});

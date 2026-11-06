import { expect, test } from "vitest";
import { accountCommand, type AccountIo } from "../src/accounts/cli.js";
import { digestPassword } from "../src/accounts/passwordDigest.js";
import { tokenDigest } from "../src/accounts/tokens.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { authContext } from "./helpers/authContext.js";

const PASSWORD = "Abcdefgh1!";

function io(answers: string[], isTty = true): AccountIo & { lines: string[] } {
    const lines: string[] = [];
    return { isTty, lines, askHidden: async () => answers.shift() ?? "", print: (line) => void lines.push(line) };
}

test("init gives user 1 the email, the admin mark and the password typed twice, once only", async () => {
    const { ctx } = authContext();
    const first = io([PASSWORD, PASSWORD]);
    expect(await accountCommand(ctx, ["init", "you@example.com"], first)).toBe(0);
    expect(first.lines).toEqual(["account you@example.com: ready"]);
    expect(await ctx.stores.accounts.account(OWNER_ID)).toMatchObject({ email: "you@example.com", isAdmin: true });
    const again = io([PASSWORD, PASSWORD]);
    expect(await accountCommand(ctx, ["init", "other@example.com"], again)).toBe(1);
    expect(again.lines).toEqual(["account init: user 1 already has an email"]);
});

test("mismatched or weak passwords, a bad email, no terminal and reset of a non-admin each refuse with their line and change nothing", async () => {
    const { ctx, auth } = authContext();
    const cases: Array<[string[], AccountIo & { lines: string[] }, string]> = [
        [["init", "you@example.com"], io([PASSWORD, "Abcdefgh1?"]), "password: the two entries differ"],
        [["init", "you@example.com"], io(["short", "short"]), "password: Use 10 to 128 characters with a lowercase letter, an uppercase letter, a digit and a symbol."],
        [["init", "not-an-email"], io([PASSWORD, PASSWORD]), "email: not a valid address"],
        [["init", "you@example.com"], io([PASSWORD, PASSWORD], false), "account: needs a terminal for the password"],
        [["reset", "nobody@example.com"], io([PASSWORD, PASSWORD]), "account reset: no admin with that email"],
    ];
    for (const [args, terminal, line] of cases) {
        expect(await accountCommand(ctx, args, terminal)).toBe(1);
        expect(terminal.lines).toEqual([line]);
        expect(terminal.lines.join("")).not.toContain(PASSWORD);
    }
    expect(auth.tables.users).toEqual([]);
});

test("reset gives an admin a new password, ends every sign-in, and records it with no network address", async () => {
    const { ctx, auth } = authContext();
    await ctx.stores.accounts.initOwner({ email: "you@example.com", emailKey: "you@example.com", passwordDigest: await digestPassword("Oldpassword1!") }, ctx.now());
    await ctx.stores.sessions.create({ idDigest: tokenDigest("s"), userId: OWNER_ID, csrfDigest: "c", createdAt: ctx.now(), lastUsedAt: ctx.now(), verifiedAt: ctx.now(), address: "direct", device: { ip: null, os: null, location: null } });
    const terminal = io(["Newpassword1!", "Newpassword1!"]);
    expect(await accountCommand(ctx, ["reset", "You@Example.com"], terminal)).toBe(0);
    expect(terminal.lines).toEqual(["account You@Example.com: password reset"]);
    expect(await ctx.stores.sessions.find(tokenDigest("s"), ctx.now())).toBeNull();
    expect(auth.events.map((event) => [event.event, event.address, event.method])).toEqual([["password_reset", null, "password"]]);
    expect(await ctx.stores.methods.passwordDigest(OWNER_ID)).toMatch(/^argon2id/);
});

import { expect, test } from "vitest";
import { GmailError, guarded } from "../src/gmail/imapErrors.js";

async function codeFor(thrown: unknown): Promise<string> {
    const error = await guarded(async () => Promise.reject(thrown)).catch((caught: unknown) => caught);
    if (!(error instanceof GmailError)) throw new Error("expected a GmailError");
    expect(`${String(error)} ${JSON.stringify(error)} ${error.stack ?? ""}`).not.toMatch(/me@example\.com|abcdefghijklmnop/);
    return error.code;
}

test("IMAP errors become a fixed code that never carries the address or password", async () => {
    const rejected = Object.assign(new Error("Invalid credentials (Failure) me@example.com"), { authenticationFailed: true, responseText: "me@example.com rejected", executedCommand: 'A1 LOGIN "me@example.com" "abcdefghijklmnop"' });
    expect(await codeFor(rejected)).toBe("bad_login");
    expect(await codeFor(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }))).toBe("unreachable");
    expect(await codeFor(Object.assign(new Error("closed"), { code: "NoConnection" }))).toBe("unreachable");
    expect(await codeFor(new Error("something else me@example.com"))).toBe("unknown");
    expect(await codeFor("weird")).toBe("unknown");
    expect(await codeFor(new GmailError("bad_login"))).toBe("bad_login");
});

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import type { Environment } from "../config/load.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import { secretKeyStatus } from "../secrets/secretKey.js";
import { mailSlot } from "../mail/fromEnv.js";
import { parseBaseUrl } from "../web/security/baseUrl.js";
import { accountCommand, type AccountIo } from "./cli.js";

/** Asks a question at the terminal without echoing what is typed. */
async function askHidden(prompt: string): Promise<string> {
    let muted = false;
    const output = new Writable({ write: (chunk: Buffer, _encoding, done) => void (muted || process.stdout.write(chunk), done()) });
    const terminal = createInterface({ input: process.stdin, output, terminal: true });
    process.stdout.write(prompt);
    muted = true;
    try {
        return await terminal.question("");
    } finally {
        muted = false;
        process.stdout.write("\n");
        terminal.close();
    }
}

/** Returns the real terminal the account command talks through. */
function terminalIo(): AccountIo {
    return { isTty: Boolean(process.stdin.isTTY), askHidden, print: (line) => console.log(line) };
}

/** Runs the account command against the configured database, closing it afterwards. */
export async function runAccountCommand(environment: Environment, args: string[]): Promise<number> {
    const stores = await openStores(parseDbSettings(environment));
    const base = parseBaseUrl(environment);
    const mail = mailSlot(environment, base.ok ? base.url.origin : null);
    const key = secretKeyStatus(environment);
    try {
        return await accountCommand({ stores, now: () => new Date().toISOString(), random: randomBytes, mail, secretKey: key.status === "ok" ? key.key : null, relyingParty: base.ok ? { id: base.url.hostname, origin: base.url.origin } : null }, args, terminalIo());
    } finally {
        await stores.close();
    }
}

import type { AlertStore, GmailConnectionRow, GmailStore } from "../db/store.js";
import { OWNER_ID } from "../db/searchSettingsStore.js";
import type { SourceStore } from "../db/sourceStore.js";
import { ALERTS_SOURCE } from "./alertJobs/source.js";
import { imapApi, type ImapFactory } from "./imap.js";
import { GmailError } from "./imapErrors.js";
import { openOrNull, seal } from "./seal.js";

export interface GmailDeps {
    gmail: GmailStore;
    alerts: AlertStore;
    sources: SourceStore;
    key: Buffer;
    imap?: ImapFactory;
}

export interface GmailLoginInput {
    email: string;
    appPassword: string;
}

export interface ConnectResult {
    ok: boolean;
    error: string | null;
}

const MAX_EMAIL = 320;
const MAX_PASSWORD = 64;

/** Connects Gmail: signs in with the address and app password first, and only if that works stores them, sealed, and adds the owner's Gmail alerts source when it is missing. */
export async function connect(deps: GmailDeps, input: GmailLoginInput, now: Date): Promise<ConnectResult> {
    const email = input.email.trim();
    const password = input.appPassword.replace(/\s+/g, "");
    const problem = inputProblem(email, password);
    if (problem !== null) return { ok: false, error: problem };
    try {
        await (deps.imap ?? imapApi)({ email, password }).verify();
    } catch (error) {
        if (!(error instanceof GmailError)) throw error;
        return { ok: false, error: error.message };
    }
    await deps.gmail.connected({ email, sealedPassword: seal(password, "app_password", deps.key) }, now.toISOString());
    await deps.sources.ensureAccountSource(OWNER_ID, { module: "gmail_alerts", name: ALERTS_SOURCE }, now.toISOString());
    return { ok: true, error: null };
}

/** Forgets the Gmail address, the app password and where alert reading stopped; revoking the password is done in the Google account. */
export async function disconnect(deps: GmailDeps): Promise<void> {
    await deps.gmail.disconnect();
    await deps.alerts.clear();
}

/** Tells whether the saved app password no longer opens, which means the server key was changed. */
export function keyChanged(deps: Pick<GmailDeps, "key">, row: GmailConnectionRow | null): boolean {
    return Boolean(row?.app_password) && openOrNull(row?.app_password ?? "", "app_password", deps.key) === null;
}

/** Explains what is wrong with the typed address or app password, or returns null when both look usable. */
function inputProblem(email: string, password: string): string | null {
    if (email.length < 3 || email.length > MAX_EMAIL || !email.includes("@")) return "Enter your Gmail address.";
    return password.length >= 1 && password.length <= MAX_PASSWORD ? null : `Enter the app password (up to ${MAX_PASSWORD} characters).`;
}

import { createTransport } from "nodemailer";
import type { MailSlot } from "../accounts/flows/context.js";
import type { MailLog } from "../db/mailLog.js";
import { smtpMailer, transportOptions } from "./mailer.js";
import { recordedMailer } from "./recorded.js";
import { parseMailSettings } from "./settings.js";

type Env = Record<string, string | undefined>;

const warned = globalThis as typeof globalThis & { __myjobbotMailWarned?: boolean };

/** Returns the mailer, each send recorded in the mail log, and the app's address for account mail, or null with mail off; a half-set configuration is logged once by name only. */
export function mailSlot(env: Env, baseUrl: string | null, log: MailLog): MailSlot | null {
    const parsed = parseMailSettings(env);
    if (!parsed.ok && !warned.__myjobbotMailWarned) console.error(parsed.message);
    warned.__myjobbotMailWarned = true;
    if (!parsed.ok || parsed.settings === null || baseUrl === null) return null;
    return { mailer: recordedMailer(smtpMailer(createTransport(transportOptions(parsed.settings)), parsed.settings.from), log), baseUrl };
}

import { MESSAGES } from "./messages.js";

const MAX_LENGTH = 254;
const CONTROL = /[\u0000-\u001f\u007f]/;
const SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s.]+$/;

export type CheckedEmail = { ok: true; email: string; emailKey: string } | { ok: false; message: string };

/** Returns the key an email is compared by: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/** Checks a typed email address, giving it trimmed with its key, or the fixed refusal. */
export function checkEmail(raw: string): CheckedEmail {
    const email = raw.trim();
    if (email.length > MAX_LENGTH || CONTROL.test(email) || !SHAPE.test(email)) return { ok: false, message: MESSAGES.email_invalid };
    return { ok: true, email, emailKey: normalizeEmail(email) };
}

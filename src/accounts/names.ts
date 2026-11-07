import { MESSAGES } from "./messages.js";

const CONTROL = /[\u0000-\u001f\u007f]/;

export type CheckedName = { ok: true; name: string } | { ok: false; message: string };

/** Checks a typed name: 1 to 100 characters once trimmed, with no line breaks or control characters. */
export function checkName(raw: string): CheckedName {
    const name = raw.trim();
    const length = Array.from(name).length;
    return length >= 1 && length <= 100 && !CONTROL.test(name) ? { ok: true, name } : { ok: false, message: MESSAGES.name_invalid };
}

/** Checks a hardware key's name: 1 to 50 characters once trimmed, with no line breaks or control characters. */
export function checkKeyName(raw: string): CheckedName {
    const name = raw.trim();
    const length = Array.from(name).length;
    return length >= 1 && length <= 50 && !CONTROL.test(name) ? { ok: true, name } : { ok: false, message: MESSAGES.key_name_invalid };
}

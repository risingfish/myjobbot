import { MESSAGES } from "./messages.js";

const CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];

/** Checks a new password against the rule, giving the rule's message when it falls short, else null. */
export function checkPassword(password: string): string | null {
    const length = Array.from(password).length;
    if (length < 10 || length > 128) return MESSAGES.password_rule;
    return CLASSES.every((pattern) => pattern.test(password)) ? null : MESSAGES.password_rule;
}

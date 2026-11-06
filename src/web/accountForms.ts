import { MESSAGES } from "../accounts/messages.js";

export type AccountField = "email" | "name" | "password" | "code";

const FIELDS = new Map<string, AccountField>([
    [MESSAGES.email_invalid, "email"],
    [MESSAGES.name_invalid, "name"],
    [MESSAGES.password_rule, "password"],
    [MESSAGES.code_refused, "code"],
    [MESSAGES.limited, "code"],
]);

/** Returns the field of the account form a refusal is about, so its message shows under that field. */
export function refusedField(message: string): AccountField {
    return FIELDS.get(message) ?? "code";
}

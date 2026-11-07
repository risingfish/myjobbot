import { expect, test } from "vitest";
import { MESSAGES } from "../src/accounts/messages.js";
import { refusedField } from "../src/web/accountForms.js";

test("each refusal of the account form belongs to the field it is about, and anything else to the code", () => {
    expect([MESSAGES.email_invalid, MESSAGES.name_invalid, MESSAGES.password_rule, MESSAGES.code_refused, MESSAGES.limited, "other"].map(refusedField)).toEqual(["email", "name", "password", "code", "code", "code"]);
});

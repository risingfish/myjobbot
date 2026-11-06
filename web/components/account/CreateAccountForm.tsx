"use client";

import { useActionState } from "react";
import { MESSAGES } from "../../../src/accounts/messages.js";
import type { AccountField } from "../../../src/web/accountForms.js";
import { createAccountForm, type CreateAccountState } from "../../lib/signInActions.js";
import { Field } from "./Field.js";

const READY: CreateAccountState = { message: null, field: null, email: "", name: "" };

/** Returns what a field shows under it: the refusal when it is about this field, else its hint. */
function noteFor(state: CreateAccountState, field: AccountField, hint: string | null = null): { invalid: boolean; note: string | null } {
    return state.field === field ? { invalid: true, note: state.message } : { invalid: false, note: hint };
}

/** Renders the account creation form, each refusal under the field it is about, keeping the email and name typed. */
export function CreateAccountForm() {
    const [state, create, creating] = useActionState(createAccountForm, READY);
    return (
        <form action={create}>
            <Field name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.email} {...noteFor(state, "email")} />
            <Field name="name" label="Name" autoComplete="name" required defaultValue={state.name} {...noteFor(state, "name")} />
            <Field name="password" label="Password" type="password" autoComplete="new-password" required {...noteFor(state, "password", MESSAGES.password_rule)} />
            <Field name="code" label="Account creation code" autoComplete="off" required {...noteFor(state, "code")} />
            <button type="submit" aria-busy={creating} disabled={creating}>
                Create account
            </button>
        </form>
    );
}

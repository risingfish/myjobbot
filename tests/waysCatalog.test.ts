import { expect, test } from "vitest";
import { CARD_KINDS, CHOICE_KINDS, wayEntry } from "../src/accounts/ways/catalog.js";

test("the Account tab's cards keep 024's order and names", () => {
    expect(CARD_KINDS).toEqual(["password", "email_link", "hardware_key", "authenticator"]);
    expect(CARD_KINDS.map((kind) => wayEntry(kind).card?.name)).toEqual(["Password", "Email me a link", "Hardware keys", "Authenticator app"]);
    expect(wayEntry("recovery_code").card).toBeNull();
});

test("the ways to choose keep 024's order, names and fields", () => {
    expect(CHOICE_KINDS).toEqual(["password", "authenticator", "recovery_code", "hardware_key"]);
    expect(CHOICE_KINDS.map((kind) => wayEntry(kind).choice?.name)).toEqual(["Password", "Authenticator app", "Recovery code", "Hardware key"]);
    expect(CHOICE_KINDS.map((kind) => wayEntry(kind).choice?.field)).toEqual([
        { kind: "text", name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        { kind: "text", name: "code", label: "Code from your app", type: "text", autoComplete: "one-time-code" },
        { kind: "text", name: "code", label: "Recovery code", type: "text", autoComplete: "one-time-code" },
        { kind: "key" },
    ]);
    expect(wayEntry("email_link").choice).toBeNull();
});

test("only the email link needs mail and counts as set up once switched on", () => {
    const kinds = [...CARD_KINDS, "recovery_code"] as const;
    expect(kinds.filter((kind) => wayEntry(kind).needsMail)).toEqual(["email_link"]);
    expect(kinds.filter((kind) => wayEntry(kind).readyWhenOn)).toEqual(["email_link"]);
});

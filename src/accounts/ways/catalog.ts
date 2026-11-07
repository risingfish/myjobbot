export const CARD_KINDS = ["password", "email_link", "hardware_key", "authenticator"] as const;

export type CardKind = (typeof CARD_KINDS)[number];

export const CHOICE_KINDS = ["password", "authenticator", "recovery_code", "hardware_key"] as const;

export type ChoiceKind = (typeof CHOICE_KINDS)[number];

type WayKind = CardKind | ChoiceKind;

type ProofField = { kind: "text"; name: "password" | "code"; label: string; type: "password" | "text"; autoComplete: string } | { kind: "key" };

interface WayEntry {
    card: { name: string } | null;
    choice: { name: string; field: ProofField } | null;
    needsMail: boolean;
    readyWhenOn: boolean;
}

const CODE = { kind: "text", name: "code", type: "text", autoComplete: "one-time-code" } as const;

const PLAIN = { needsMail: false, readyWhenOn: false };

const WAYS: Record<WayKind, WayEntry> = {
    password: { ...PLAIN, card: { name: "Password" }, choice: { name: "Password", field: { kind: "text", name: "password", label: "Password", type: "password", autoComplete: "current-password" } } },
    email_link: { card: { name: "Email me a link" }, choice: null, needsMail: true, readyWhenOn: true },
    hardware_key: { ...PLAIN, card: { name: "Hardware keys" }, choice: { name: "Hardware key", field: { kind: "key" } } },
    authenticator: { ...PLAIN, card: { name: "Authenticator app" }, choice: { name: "Authenticator app", field: { ...CODE, label: "Code from your app" } } },
    recovery_code: { ...PLAIN, card: null, choice: { name: "Recovery code", field: { ...CODE, label: "Recovery code" } } },
};

/** Gives a way of signing in as the UI and the rules see it: its card, its choice and field, and its mail rules. */
export function wayEntry(kind: WayKind): WayEntry {
    return WAYS[kind];
}

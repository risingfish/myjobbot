export const CARD_KINDS = ["password", "email_link", "hardware_key", "authenticator"] as const;

export type CardKind = (typeof CARD_KINDS)[number];

export const CHOICE_KINDS = ["password", "authenticator", "recovery_code", "hardware_key"] as const;

export type ChoiceKind = (typeof CHOICE_KINDS)[number];

type WayKind = CardKind | ChoiceKind;

type ProofField = { kind: "text"; name: "password" | "code"; label: string; type: "password" | "text"; autoComplete: string } | { kind: "key" };

interface Choice {
    name: string;
    field: ProofField;
}

const CARD_NAMES: Record<CardKind, string> = { password: "Password", email_link: "Email me a link", hardware_key: "Hardware keys", authenticator: "Authenticator app" };

const CODE = { kind: "text", name: "code", type: "text", autoComplete: "one-time-code" } as const;

const CHOICES: Record<ChoiceKind, Choice> = {
    password: { name: "Password", field: { kind: "text", name: "password", label: "Password", type: "password", autoComplete: "current-password" } },
    authenticator: { name: "Authenticator app", field: { ...CODE, label: "Code from your app" } },
    recovery_code: { name: "Recovery code", field: { ...CODE, label: "Recovery code" } },
    hardware_key: { name: "Hardware key", field: { kind: "key" } },
};

const NEEDS_MAIL: readonly WayKind[] = ["email_link"];

/** Gives a card's name on the Account tab. */
export function cardName(kind: CardKind): string {
    return CARD_NAMES[kind];
}

/** Gives a way's name and field where it is chosen, on the sign-in form and in "Confirm it's you". */
export function choiceOf(kind: ChoiceKind): Choice {
    return CHOICES[kind];
}

/** Gives a way of signing in as the UI and the rules see it: its card, its choice, and its mail rules (needing mail, and set up once switched on). */
export function wayEntry(kind: WayKind) {
    const card = CARD_KINDS.find((cardKind) => cardKind === kind);
    const choice = CHOICE_KINDS.find((choiceKind) => choiceKind === kind);
    const needsMail = NEEDS_MAIL.includes(kind);
    return { card: card === undefined ? null : { name: cardName(card) }, choice: choice === undefined ? null : choiceOf(choice), needsMail, readyWhenOn: needsMail };
}

import type { AlertStateRow, GmailConnectionRow, GmailStatus } from "../db/store.js";

type GmailOffer = "connect" | "check" | "disconnect" | "replace";
type KeyStatus = "missing" | "invalid" | "ok";

interface PanelContext {
    keyStatus: KeyStatus;
    keyChanged: boolean;
    alertState?: AlertStateRow | null;
}

export interface GmailPanelView {
    keyStatus: KeyStatus;
    state: GmailStatus | "key_changed";
    message: string | null;
    offers: GmailOffer[];
    email: string | null;
    connectedAt: string | null;
    reason: string | null;
    lastRun: string | null;
}

const RESTART = "then recreate the containers (docker compose up -d) or restart the dev server";
const KEY_MESSAGES: Record<Exclude<KeyStatus, "ok">, string> = {
    missing: `Set MYJOBBOT_SECRET_KEY in .env, ${RESTART}, to use Gmail.`,
    invalid: `MYJOBBOT_SECRET_KEY is invalid: it must be 32 bytes in base64 (openssl rand -base64 32). Fix it, ${RESTART}.`,
};
const NOT_CONNECTED = "Connect with your Gmail address and an app password. Create or delete app passwords at https://myaccount.google.com/apppasswords (2-step verification must be on).";
const KEY_CHANGED = "Server key changed; enter the app password again";
const NOTHING_SAVED: GmailConnectionRow = { email: null, app_password: null, connected_at: null, status: "none", reason: null };
const OFFERS: Record<GmailStatus, GmailOffer[]> = {
    none: ["connect"],
    connected: ["check", "disconnect", "replace"],
    needs_reconnect: ["connect", "disconnect"],
};

/** Works out what the Gmail panel shows and offers, from the stored connection and the server key. */
export function gmailPanelView(row: GmailConnectionRow | null, context: PanelContext): GmailPanelView {
    const stored = row ?? NOTHING_SAVED;
    const state = stored.status;
    const view: GmailPanelView = { keyStatus: context.keyStatus, state, message: null, offers: OFFERS[state], email: stored.email, connectedAt: localTime(stored.connected_at), reason: stored.reason, lastRun: state === "connected" ? lastRun(context.alertState ?? null) : null };
    if (context.keyStatus !== "ok") return { ...view, message: KEY_MESSAGES[context.keyStatus], offers: [] };
    if (context.keyChanged) return { ...view, state: "key_changed", message: KEY_CHANGED, offers: ["connect"] };
    return state === "none" ? { ...view, message: NOT_CONNECTED } : view;
}

/** Shows a stored UTC time as YYYY-MM-DD HH:mm in the server's time zone, or null when there is none. */
export function localTime(iso: string | null): string | null {
    return iso === null ? null : new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** Describes the last run's alert reading for the panel, or null before any run read alerts. */
function lastRun(state: AlertStateRow | null): string | null {
    if (state?.last_run_at === null || state === null) return null;
    const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
    return `Last run ${localTime(state.last_run_at) ?? ""}: ${plural(state.emails_read, "alert email")}, ${plural(state.jobs_found, "job")}, ${state.not_understood} not understood`;
}

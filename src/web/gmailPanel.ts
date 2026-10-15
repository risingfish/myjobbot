import type { GmailConnectionRow, GmailStatus } from "../db/store.js";
import { isLoopbackHost } from "../gmail/connectRequest.js";

type GmailOffer = "save" | "connect" | "check" | "disconnect" | "replace" | "clear";
type KeyStatus = "missing" | "invalid" | "ok";

interface PanelContext {
    keyStatus: KeyStatus;
    keyChanged: boolean;
    host: string;
}

export interface GmailPanelView {
    keyStatus: KeyStatus;
    clientId: string | null;
    secretSaved: boolean;
    state: GmailStatus | "key_changed";
    message: string | null;
    offers: GmailOffer[];
    email: string | null;
    connectedAt: string | null;
    reason: string | null;
    canConnect: boolean;
    connectHint: string | null;
}

const RESTART = "then recreate the containers (docker compose up -d) or restart the dev server";
const KEY_MESSAGES: Record<Exclude<KeyStatus, "ok">, string> = {
    missing: `Set MYJOBBOT_SECRET_KEY in .env, ${RESTART}, to use Gmail.`,
    invalid: `MYJOBBOT_SECRET_KEY is invalid: it must be 32 bytes in base64 (openssl rand -base64 32). Fix it, ${RESTART}.`,
};
const NOTHING_SAVED: GmailConnectionRow = { client_id: null, client_secret: null, credentials_saved_at: null, refresh_token: null, email: null, connected_at: null, status: "none", reason: null };
const KEY_CHANGED = "Server key changed; enter the client secret again";
const OFFERS: Record<GmailStatus, GmailOffer[]> = {
    none: ["connect", "replace", "clear"],
    connected: ["check", "disconnect", "replace", "clear"],
    needs_reconnect: ["connect", "disconnect", "replace", "clear"],
};

/** Works out what the Gmail panel shows and offers, from the stored connection, the server key and the address Settings was opened on. */
export function gmailPanelView(row: GmailConnectionRow | null, context: PanelContext): GmailPanelView {
    const view = baseView(row, context);
    if (context.keyStatus !== "ok") return { ...view, message: KEY_MESSAGES[context.keyStatus], offers: [] };
    if (context.keyChanged) return { ...view, state: "key_changed", message: KEY_CHANGED, offers: ["save"] };
    if (!view.secretSaved) return { ...view, offers: ["save"] };
    const offers = OFFERS[view.state === "key_changed" ? "none" : view.state];
    const local = isLoopbackHost(context.host);
    const canConnect = offers.includes("connect") && local;
    return { ...view, offers, canConnect, connectHint: offers.includes("connect") && !local ? connectHint(context.host) : null };
}

/** Copies the displayable parts of the stored connection, leaving every secret behind. */
function baseView(row: GmailConnectionRow | null, context: PanelContext): GmailPanelView {
    const stored = row ?? NOTHING_SAVED;
    const secretSaved = stored.client_id !== null && stored.client_secret !== null;
    return { keyStatus: context.keyStatus, clientId: stored.client_id, secretSaved, state: stored.status, message: null, offers: [], email: stored.email, connectedAt: stored.connected_at, reason: stored.reason, canConnect: false, connectHint: null };
}

/** Tells the owner which address to open Settings on so Google can send them back after signing in. */
function connectHint(host: string): string {
    const port = /:(\d+)$/.exec(host)?.[1] ?? "8080";
    return `Open Settings at http://localhost:${port} to connect`;
}

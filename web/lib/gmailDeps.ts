import type { GmailDeps } from "../../src/gmail/connection.js";
import { getStores } from "./uiState.js";

/** Returns what the Gmail services need, or null when the server key isn't usable, without needing any search settings stored. */
export async function gmailDeps(): Promise<GmailDeps | null> {
    const { stores, key } = await getStores();
    return key.status === "ok" ? { gmail: stores.gmail, alerts: stores.alerts, key: key.key } : null;
}

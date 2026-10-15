import type { GmailDeps } from "../../src/gmail/connection.js";
import { getUiState } from "./uiState.js";

/** Returns what the Gmail services need, or null when the server key isn't usable. */
export async function gmailDeps(): Promise<GmailDeps | null> {
    const { gmail, key } = await getUiState();
    return key.status === "ok" ? { gmail, key: key.key } : null;
}

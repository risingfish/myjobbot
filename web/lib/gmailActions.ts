"use server";

import { revalidatePath } from "next/cache.js";
import { clearCredentials, saveCredentials, type GmailDeps, type SaveResult } from "../../src/gmail/connection.js";
import { getUiState } from "./uiState.js";

const KEY_NOT_SET: SaveResult = { ok: false, error: "Set MYJOBBOT_SECRET_KEY first." };

/** Returns what the Gmail services need, or null when the server key isn't usable. */
async function gmailDeps(): Promise<GmailDeps | null> {
    const { gmail, key } = await getUiState();
    return key.status === "ok" ? { gmail, key: key.key } : null;
}

/** Saves the owner's Google OAuth client from the Settings form, reporting a field problem if it is refused. */
export async function saveGmailCredentials(_previous: SaveResult, form: FormData): Promise<SaveResult> {
    const deps = await gmailDeps();
    if (deps === null) return KEY_NOT_SET;
    const input = { clientId: String(form.get("client_id") ?? ""), clientSecret: String(form.get("client_secret") ?? "") };
    const result = await saveCredentials(deps, input, new Date());
    if (result.ok) revalidatePath("/settings");
    return result;
}

/** Forgets the owner's Google OAuth client from the Settings form. */
export async function clearGmailCredentials(): Promise<void> {
    const deps = await gmailDeps();
    if (deps === null) return;
    await clearCredentials(deps);
    revalidatePath("/settings");
}

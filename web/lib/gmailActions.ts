"use server";

import { revalidatePath } from "next/cache.js";
import { headers } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { clearCredentials, saveCredentials, type SaveResult } from "../../src/gmail/connection.js";
import { connectTarget } from "./gmailConnect.js";
import { gmailDeps } from "./gmailDeps.js";

const KEY_NOT_SET: SaveResult = { ok: false, error: "Set MYJOBBOT_SECRET_KEY first." };

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

/** Starts connecting Gmail: sends the owner to Google's consent screen, or back to Settings saying why it can't. */
export async function connectGmail(): Promise<void> {
    redirect(await connectTarget((await headers()).get("host") ?? ""));
}

"use server";

import { revalidatePath } from "next/cache.js";
import { check, type CheckResult } from "../../src/gmail/check.js";
import { connect, disconnect, type ConnectResult } from "../../src/gmail/connection.js";
import { gmailDeps } from "./gmailDeps.js";
import { getUiState } from "./uiState.js";

const KEY_NOT_SET = "Set MYJOBBOT_SECRET_KEY first.";

/** Connects Gmail from the Settings form: signs in with the address and app password, then saves them sealed. */
export async function connectGmail(_previous: ConnectResult, form: FormData): Promise<ConnectResult> {
    const deps = await gmailDeps();
    if (deps === null) return { ok: false, error: KEY_NOT_SET };
    const input = { email: String(form.get("email") ?? ""), appPassword: String(form.get("app_password") ?? "") };
    const result = await connect(deps, input, new Date());
    if (result.ok) revalidatePath("/settings");
    return result;
}

/** Counts recent job-alert emails for the Check now button. */
export async function checkGmail(): Promise<CheckResult> {
    const deps = await gmailDeps();
    if (deps === null) return { ok: false, reason: KEY_NOT_SET };
    const result = await check(deps, (await getUiState()).config.gmail.alert_senders);
    if (!result.ok) revalidatePath("/settings");
    return result;
}

/** Forgets the Gmail address and app password for the Disconnect button. */
export async function disconnectGmail(): Promise<{ ok: boolean }> {
    const deps = await gmailDeps();
    if (deps === null) return { ok: false };
    await disconnect(deps);
    revalidatePath("/settings");
    return { ok: true };
}

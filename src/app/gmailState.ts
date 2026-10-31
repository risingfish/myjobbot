import type { GmailStore } from "../db/store.js";
import { alertsUsability, gmailConnected } from "../gmail/alertJobs/usable.js";
import type { SecretKeyStatus } from "../gmail/secretKey.js";

export interface GmailState {
    usable: true | string;
    connected: boolean;
}

/** Settles once per run whether Gmail is connected, and whether the Gmail alerts source can be read or the fixed note saying why not. */
export async function gmailState(gmail: GmailStore, key: SecretKeyStatus): Promise<GmailState> {
    const row = await gmail.connection();
    const usability = alertsUsability(row, key);
    return { usable: usability.usable ? true : usability.note, connected: gmailConnected(row) };
}

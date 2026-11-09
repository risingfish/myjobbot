import type { Actor } from "../../src/accounts/flows/context.js";
import { webSettings, type WebSettings } from "./webSettings.js";
import { requestAddress } from "./requestAuth.js";
import { requireSession } from "./session.js";

/** Returns the signed-in account as the account flows act for it, with this request's settings, or null when the UI's address isn't set. */
export async function actorNow(): Promise<{ actor: Actor; settings: WebSettings } | null> {
    const settings = webSettings();
    if (settings === null) return null;
    const { account, session } = await requireSession();
    return { actor: { account, session, address: await requestAddress(settings) }, settings };
}

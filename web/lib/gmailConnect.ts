import { finishConnect, startConnect, type Callback } from "../../src/gmail/connection.js";
import { isLoopbackHost } from "../../src/gmail/connectRequest.js";
import { gmailDeps } from "./gmailDeps.js";

/** Returns where Connect Gmail sends the owner: Google's consent screen, or back to Settings with the reason it can't start. */
export async function connectTarget(host: string): Promise<string> {
    const deps = await gmailDeps();
    if (deps === null) return settingsWith("key_not_set");
    if (!isLoopbackHost(host)) return settingsWith("not_loopback");
    const started = await startConnect(deps, host, new Date());
    return started.ok ? started.url : settingsWith(started.reason);
}

/** Finishes the sign-in Google sent the owner back from, returning the Settings address that reports the outcome. */
export async function callbackTarget(callback: Callback): Promise<string> {
    const deps = await gmailDeps();
    return settingsWith(deps === null ? "key_not_set" : await finishConnect(deps, callback, new Date()));
}

/** Returns the Settings path carrying a fixed outcome code. */
function settingsWith(code: string): string {
    return `/settings?gmail=${code}`;
}

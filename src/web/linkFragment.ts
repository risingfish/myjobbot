import type { LinkPurpose } from "../db/tokenStore.js";

const PURPOSES = new Set<string>(["signin", "reset", "email_change", "step_up"]);
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export interface LinkInFragment {
    purpose: LinkPurpose;
    token: string;
}

/** Reads an emailed link's purpose and token from the address's fragment, which never reaches the server, or null when it isn't one. */
export function parseLinkFragment(hash: string): LinkInFragment | null {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const purpose = params.get("p") ?? "";
    const token = params.get("t") ?? "";
    return PURPOSES.has(purpose) && TOKEN.test(token) ? { purpose: purpose as LinkPurpose, token } : null;
}

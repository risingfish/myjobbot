import { LINK_PURPOSES, type LinkPurpose } from "../db/emailLinkStore.js";

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
    return isLinkPurpose(purpose) && TOKEN.test(token) ? { purpose, token } : null;
}

/** Tells whether a value names one of the emailed links' purposes. */
function isLinkPurpose(value: string): value is LinkPurpose {
    return (LINK_PURPOSES as readonly string[]).includes(value);
}

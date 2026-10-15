export type GmailErrorCode = "bad_login" | "unreachable" | "unknown";

const NETWORK = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "EHOSTUNREACH", "NoConnection"]);

const MESSAGES: Record<GmailErrorCode, string> = {
    bad_login: "Gmail rejected the address or app password.",
    unreachable: "Gmail couldn't be reached; try again.",
    unknown: "Gmail sign-in failed; try again.",
};

export class GmailError extends Error {
    /** Reports a failed Gmail call by a fixed code only, so no address, password or server reply travels with it. */
    constructor(readonly code: GmailErrorCode) {
        super(MESSAGES[code]);
        this.name = "GmailError";
    }
}

/** Reduces whatever the IMAP library threw to a fixed code, reading only its authentication flag and network error code. */
function imapErrorCode(error: unknown): GmailErrorCode {
    if (typeof error !== "object" || error === null) return "unknown";
    const { authenticationFailed, code } = error as { authenticationFailed?: unknown; code?: unknown };
    if (authenticationFailed === true) return "bad_login";
    return typeof code === "string" && NETWORK.has(code) ? "unreachable" : "unknown";
}

/** Runs an IMAP call, replacing any error it throws with a GmailError that carries only a code. */
export async function guarded<T>(call: () => Promise<T>): Promise<T> {
    try {
        return await call();
    } catch (error) {
        throw error instanceof GmailError ? error : new GmailError(imapErrorCode(error));
    }
}

export type GoogleErrorCode = "invalid_grant" | "invalid_client" | "unauthorized_client" | "access_denied" | "network" | "unknown";

const KNOWN = new Set<string>(["invalid_grant", "invalid_client", "unauthorized_client", "access_denied"]);
const UNAUTHORIZED = 401;

interface ResponseLike {
    response?: { status?: unknown; data?: unknown };
}

export class GoogleError extends Error {
    /** Reports a failed Google call by a fixed code only, so no request, token or secret travels with it. */
    constructor(readonly code: GoogleErrorCode) {
        super(`Google request failed: ${code}`);
        this.name = "GoogleError";
    }
}

/** Reduces whatever the Google library threw to a fixed code, reading only the response's error field and status. */
function googleErrorCode(error: unknown): GoogleErrorCode {
    const response = typeof error === "object" && error !== null ? (error as ResponseLike).response : undefined;
    if (response === undefined) return error instanceof Error ? "network" : "unknown";
    const data = response.data;
    const named = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : undefined;
    if (typeof named === "string" && KNOWN.has(named)) return named as GoogleErrorCode;
    return response.status === UNAUTHORIZED ? "invalid_grant" : "unknown";
}

/** Runs a Google call, replacing any error it throws with a GoogleError that carries only a code. */
export async function guarded<T>(call: () => Promise<T>): Promise<T> {
    try {
        return await call();
    } catch (error) {
        throw error instanceof GoogleError ? error : new GoogleError(googleErrorCode(error));
    }
}

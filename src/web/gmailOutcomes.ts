const MESSAGES: Record<string, string> = {
    connected: "Connected.",
    denied: "Access was not granted.",
    refused: "That sign-in link expired or was already used; try again.",
    bad_client: "Google rejected the client ID or secret.",
    key_changed: "Server key changed; enter the client secret again.",
    failed: "Google sign-in failed; try again.",
    key_not_set: "Set MYJOBBOT_SECRET_KEY first.",
    not_loopback: "Open Settings at http://localhost:8080 to connect.",
    no_credentials: "Save the client ID and secret first.",
};

/** Returns the fixed message for a sign-in outcome code from the address bar, or null for anything unknown. */
export function outcomeMessage(code: string | string[] | undefined): string | null {
    return typeof code === "string" && Object.hasOwn(MESSAGES, code) ? (MESSAGES[code] ?? null) : null;
}

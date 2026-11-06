import { isIP } from "node:net";

/** Returns the key a client is counted by: one shared key with no trusted proxy, else the address that many proxies from the right, or "unknown". */
export function clientAddress(forwardedFor: string | null, hops: number): string {
    if (hops === 0) return "direct";
    const entries = (forwardedFor ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
    const entry = entries[Math.max(entries.length - hops, 0)];
    return entry !== undefined && isIP(entry) !== 0 ? entry : "unknown";
}

/** Returns the client IP address shown with a sign-in: the trusted proxies' client, or with none the address the server saw; null when it isn't an address. */
export function displayIp(forwardedFor: string | null, hops: number): string | null {
    const entries = (forwardedFor ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
    const entry = hops === 0 ? entries[0] : entries[Math.max(entries.length - hops, 0)];
    return entry !== undefined && isIP(entry) !== 0 ? entry : null;
}

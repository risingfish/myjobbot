import { isIP } from "node:net";

/** Returns the key a client is counted by: one shared key with no trusted proxy, else the address that many proxies from the right, or "unknown". */
export function clientAddress(forwardedFor: string | null, hops: number): string {
    if (hops === 0) return "direct";
    const entries = (forwardedFor ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
    const entry = entries[Math.max(entries.length - hops, 0)];
    return entry !== undefined && isIP(entry) !== 0 ? entry : "unknown";
}

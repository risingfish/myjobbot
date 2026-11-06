import { BlockList, isIP } from "node:net";

export interface Position {
    lat: number;
    lng: number;
}

export interface Place {
    city: string;
    region: string;
    country: string;
}

const HINTS: Record<string, string> = { Windows: "Windows", macOS: "macOS", Linux: "Linux", Android: "Android", iOS: "iOS", "Chrome OS": "ChromeOS", "Chromium OS": "ChromeOS" };

const AGENTS: Array<[RegExp, string]> = [
    [/iPhone|iPad|iPod/, "iOS"],
    [/Android/, "Android"],
    [/CrOS/, "ChromeOS"],
    [/Windows/, "Windows"],
    [/Macintosh|Mac OS X/, "macOS"],
    [/Linux|X11/, "Linux"],
];

const LOCAL = new BlockList();
for (const [network, prefix] of [["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["127.0.0.0", 8], ["169.254.0.0", 16]] as const) LOCAL.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [["::1", 128], ["fc00::", 7], ["fe80::", 10]] as const) LOCAL.addSubnet(network, prefix, "ipv6");

/** Returns the device's operating system from the browser's platform hint when it sends one, else from its user agent; never the raw text. */
export function osFrom(platformHint: string | null, userAgent: string | null): string {
    const hint = platformHint?.replaceAll('"', "").trim() ?? "";
    if (HINTS[hint]) return HINTS[hint];
    return AGENTS.find(([pattern]) => pattern.test(userAgent ?? ""))?.[1] ?? "Unknown";
}

/** Returns the browser's shared position as numbers rounded to one decimal (about 10 km), or null when it isn't a valid one. */
export function roundedPosition(lat: string | null, lng: string | null): Position | null {
    const [y, x] = [Number(lat ?? ""), Number(lng ?? "")];
    const valid = lat !== null && lat !== "" && lng !== null && lng !== "" && Math.abs(y) <= 90 && Math.abs(x) <= 180;
    return valid ? { lat: Math.round(y * 10) / 10, lng: Math.round(x * 10) / 10 } : null;
}

/** Says whether an address is on a local or private network. */
function isLocal(ip: string): boolean {
    const family = isIP(ip) === 6 ? "ipv6" : "ipv4";
    return LOCAL.check(ip, family);
}

/** Returns where a sign-in came from: the browser's rounded position when shared, Local network for a LAN address, else the IP's place. */
export function locationLabel(input: { position: Position | null; ip: string | null }, lookup: (ip: string) => Place | null): string | null {
    if (input.position !== null) return `${input.position.lat.toFixed(1)}, ${input.position.lng.toFixed(1)} (from your browser)`;
    if (input.ip === null) return null;
    if (isLocal(input.ip)) return "Local network";
    const place = lookup(input.ip);
    const parts = place === null ? [] : [place.city, place.region, place.country].filter((part) => part !== "");
    return parts.length > 0 ? parts.join(", ") : "Unknown";
}

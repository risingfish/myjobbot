import { BlockList, isIP } from "node:net";

const BLOCKED_V4: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
];

const BLOCKED_V6: Array<[string, number]> = [
    ["::", 128],
    ["::1", 128],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
];

const MAPPED = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;
const BYTE = 256;
const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED = blockList();

/** Builds the list of address ranges a careers fetch must never reach: this host, the LAN, and other non-public ranges. */
function blockList(): BlockList {
    const list = new BlockList();
    for (const [network, prefix] of BLOCKED_V4) list.addSubnet(network, prefix, "ipv4");
    for (const [network, prefix] of BLOCKED_V6) list.addSubnet(network, prefix, "ipv6");
    return list;
}

/** Tells whether an IP address is on the public internet, so a careers fetch may connect to it. */
export function isPublicAddress(ip: string): boolean {
    const plain = unmapped(ip);
    const family = isIP(plain);
    if (family === 0) return false;
    return !BLOCKED.check(plain, family === 4 ? "ipv4" : "ipv6");
}

/** Turns an IPv4-mapped IPv6 address back into IPv4, so it is checked against the IPv4 ranges. */
function unmapped(ip: string): string {
    if (isIP(ip) !== 6) return ip;
    const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const match = MAPPED.exec(normalized);
    if (match === null) return normalized;
    const [high, low] = [Number.parseInt(match[1] ?? "0", 16), Number.parseInt(match[2] ?? "0", 16)];
    return [Math.floor(high / BYTE), high % BYTE, Math.floor(low / BYTE), low % BYTE].join(".");
}

/** Tells whether an address is a plain web address a careers fetch may open: http(s), default port, no credentials. */
export function allowedUrl(raw: string): boolean {
    if (!URL.canParse(raw)) return false;
    const url = new URL(raw);
    return WEB_PROTOCOLS.has(url.protocol) && url.port === "" && url.username === "" && url.password === "";
}

import { isIP } from "node:net";
import { allowedUrl } from "../careers/addresses.js";

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);
const MAX_ADDRESS = 2000;

/** Gives the part of a host that names the site, without www, its top-level domain or a common two-part country suffix. */
export function mainName(host: string): string | null {
    const labels = host.toLowerCase().split(".").filter((label) => label !== "www");
    if (labels.length < 2) return null;
    const topLevel = labels.pop() ?? "";
    if (topLevel.length === 2 && labels.length > 1 && SECOND_LEVEL.has(labels.at(-1) ?? "")) labels.pop();
    return labels.at(-1) ?? null;
}

/** Tells whether an address may be kept on a company's record: a plain public-looking web address, not an IP address or a local name. */
export function storableUrl(raw: string): boolean {
    if (raw.length > MAX_ADDRESS || !allowedUrl(raw)) return false;
    const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
    return isIP(host) === 0 && host.includes(".");
}

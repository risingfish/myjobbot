const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Splits a web address with no port into its decoded path parts, or gives null for any other address, so a board only reads links it could fetch. */
export function linkParts(url: URL): string[] | null {
    if (!WEB_PROTOCOLS.has(url.protocol) || url.port !== "") return null;
    return url.pathname
        .split("/")
        .filter((part) => part !== "")
        .map(decodeURIComponent);
}

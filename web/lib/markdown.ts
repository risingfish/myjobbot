const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Keeps a link's address when it is a web address, and empties any other so the link shows as plain words. */
export function markdownHref(url: string): string {
    return URL.canParse(url) && WEB_PROTOCOLS.has(new URL(url).protocol) ? url : "";
}

/** Places a description's heading below the panel's own section headings, so it never outranks "Description". */
export function descriptionHeading(level: number): "h4" | "h5" | "h6" {
    if (level <= 2) return "h4";
    return level === 3 ? "h5" : "h6";
}

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** Tells whether an address is a web (http or https) address, the only kind a description may link to. */
export function isWebAddress(url: string): boolean {
    return URL.canParse(url) && WEB_PROTOCOLS.has(new URL(url).protocol);
}

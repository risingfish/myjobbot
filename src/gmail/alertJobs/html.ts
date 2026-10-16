const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

/** Turns an HTML fragment into plain text: tags removed, entities decoded, whitespace collapsed. */
export function htmlText(fragment: string): string {
    const text = fragment.replace(/<[^>]*>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => decodeEntity(whole, name));
    return text.replace(/\s+/g, " ").trim();
}

/** Decodes one HTML entity, leaving unknown ones as written. */
function decodeEntity(whole: string, name: string): string {
    if (name.startsWith("#x") || name.startsWith("#X")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return NAMED[name.toLowerCase()] ?? whole;
}

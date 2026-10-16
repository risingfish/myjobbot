const MAX_CODE_POINT = 0x10ffff;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

/** Turns an HTML fragment into plain text: tags removed, entities decoded, whitespace collapsed. */
export function htmlText(fragment: string): string {
    const text = fragment.replace(/<[^>]*>/g, " ").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => decodeEntity(whole, name));
    return text.replace(/\s+/g, " ").trim();
}

/** Decodes one HTML entity, leaving unknown ones and impossible character numbers as written. */
function decodeEntity(whole: string, name: string): string {
    if (!name.startsWith("#")) return NAMED[name.toLowerCase()] ?? whole;
    const hex = name[1] === "x" || name[1] === "X";
    const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code >= 0 && code <= MAX_CODE_POINT ? String.fromCodePoint(code) : whole;
}

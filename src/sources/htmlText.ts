const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const MAX_CODE_POINT = 0x10ffff;

/** Replaces HTML character entities in text with their literal characters, once: used to unescape HTML a board sends escaped. */
export function decodeEntities(text: string): string {
    return text.replace(ENTITY, (match, name: string) => entityText(name.toLowerCase()) ?? match);
}

/** Returns the literal character for a named or numeric HTML entity, or undefined if unrecognized. */
function entityText(name: string): string | undefined {
    if (name.startsWith("#x")) return fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return fromCodePoint(Number.parseInt(name.slice(1), 10));
    return NAMED_ENTITIES[name];
}

/** Converts a numeric code point into its character, or undefined if it's out of range. */
function fromCodePoint(value: number): string | undefined {
    return Number.isInteger(value) && value >= 0 && value <= MAX_CODE_POINT ? String.fromCodePoint(value) : undefined;
}

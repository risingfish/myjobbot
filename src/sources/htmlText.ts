const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const BLOCK_TAG = /<\/?(br|p|div|li|ul|ol|h[1-6]|tr)\b[^>]*>/gi;
const ANY_TAG = /<[^>]*>/g;
const MAX_CODE_POINT = 0x10ffff;

export function escapedHtmlToText(escaped: string): string {
  const markup = decodeEntities(escaped);
  const text = decodeEntities(markup.replace(BLOCK_TAG, "\n").replace(ANY_TAG, ""));
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

function decodeEntities(text: string): string {
  return text.replace(ENTITY, (match, name: string) => entityText(name.toLowerCase()) ?? match);
}

function entityText(name: string): string | undefined {
  if (name.startsWith("#x")) return fromCodePoint(Number.parseInt(name.slice(2), 16));
  if (name.startsWith("#")) return fromCodePoint(Number.parseInt(name.slice(1), 10));
  return NAMED_ENTITIES[name];
}

function fromCodePoint(value: number): string | undefined {
  return Number.isInteger(value) && value >= 0 && value <= MAX_CODE_POINT ? String.fromCodePoint(value) : undefined;
}

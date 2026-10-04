export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasWord(normalizedTitle: string, term: string): boolean {
  return new RegExp(`\\b${normalizeTitle(term)}s?\\b`).test(normalizedTitle);
}

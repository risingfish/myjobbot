/** Normalizes text for matching by lowercasing it and collapsing non-alphanumerics to single spaces. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reports whether a term appears as a whole word (optionally pluralized) in already-normalized text. */
export function hasWord(normalizedTitle: string, term: string): boolean {
  return new RegExp(`\\b${normalizeTitle(term)}s?\\b`).test(normalizedTitle);
}

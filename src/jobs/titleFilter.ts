import type { FileConfig } from "../config/schema.js";
import { hasWord, normalizeTitle } from "./normalize.js";

export function passesTitleFilter(title: string, filter: FileConfig["title_filter"]): boolean {
  const normalized = normalizeTitle(title);
  const startsWord = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}`).test(normalized);
  return filter.include.some(startsWord) && !filter.exclude.some((term) => hasWord(normalized, term));
}

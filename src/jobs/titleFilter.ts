import type { FileConfig } from "../config/schema.js";
import { hasWord, normalizeTitle } from "./normalize.js";

/** Reports whether a job title matches an include term and none of the configured exclude terms. */
export function passesTitleFilter(title: string, filter: FileConfig["title_filter"]): boolean {
  const normalized = normalizeTitle(title);
  /** Reports whether some word in the title starts with the term, so "engineer" also matches "Engineering". */
  const startsWord = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}`).test(normalized);
  return filter.include.some(startsWord) && !filter.exclude.some((term) => hasWord(normalized, term));
}

import type { FileConfig } from "../config/schema.js";
import { normalizeTitle } from "./normalize.js";

export function passesTitleFilter(title: string, filter: FileConfig["title_filter"]): boolean {
  const normalized = normalizeTitle(title);
  const startsWord = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}`).test(normalized);
  const isWord = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}s?\\b`).test(normalized);
  return filter.include.some(startsWord) && !filter.exclude.some(isWord);
}

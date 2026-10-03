import type { FileConfig } from "../config/schema.js";
import { normalizeTitle } from "./normalize.js";

export function passesTitleFilter(title: string, filter: FileConfig["title_filter"]): boolean {
  const normalized = normalizeTitle(title);
  const mentions = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}`).test(normalized);
  return filter.include.some(mentions) && !filter.exclude.some(mentions);
}

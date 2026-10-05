import { hasWord, normalizeTitle } from "./normalize.js";

export function isExcludedCompany(company: string, excluded: string[]): boolean {
  const normalized = normalizeTitle(company);
  return excluded.some((name) => hasWord(normalized, name));
}

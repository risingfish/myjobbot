import { hasWord, normalizeTitle } from "./normalize.js";

/** Reports whether a company name matches one of the user's excluded companies. */
export function isExcludedCompany(company: string, excluded: string[]): boolean {
  const normalized = normalizeTitle(company);
  return excluded.some((name) => hasWord(normalized, name));
}

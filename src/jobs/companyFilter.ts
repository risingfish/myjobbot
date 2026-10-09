import { hasWord, normalizeTitle } from "./normalize.js";

/** Reports whether a company name matches one of the user's excluded companies. */
export function isExcludedCompany(company: string, excluded: string[]): boolean {
  return matchesAnyName(company, excluded);
}

/** Reports whether a JSearch publisher matches one of the user's excluded job boards. */
export function isExcludedPublisher(publisher: string | null, excluded: string[]): boolean {
  return publisher !== null && matchesAnyName(publisher, excluded);
}

/** Reports whether any of the names appears as whole words in the text, ignoring case and punctuation. */
function matchesAnyName(text: string, names: string[]): boolean {
  const normalized = normalizeTitle(text);
  return names.some((name) => hasWord(normalized, name));
}

import type { Job } from "./job.js";
import { hasWord, normalizeTitle } from "./normalize.js";
import { isDomainEntry, linkMatchesDomains } from "./publisherDomain.js";

/** Reports whether a company name matches one of the user's excluded companies. */
export function isExcludedCompany(company: string, excluded: string[]): boolean {
  return matchesAnyName(company, excluded);
}

/** Reports whether a JSearch job comes from an excluded board, by publisher name or by apply-link domain. */
export function isExcludedPublisher(job: Pick<Job, "publisher" | "url">, excluded: string[]): boolean {
  const domains = excluded.filter(isDomainEntry);
  const names = excluded.filter((entry) => !isDomainEntry(entry));
  return (job.publisher !== null && matchesAnyName(job.publisher, names)) || linkMatchesDomains(job.url, domains);
}

/** Reports whether any of the names appears as whole words in the text, ignoring case and punctuation. */
function matchesAnyName(text: string, names: string[]): boolean {
  const normalized = normalizeTitle(text);
  return names.some((name) => hasWord(normalized, name));
}

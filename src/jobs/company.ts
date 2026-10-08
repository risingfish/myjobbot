import { normalizeTitle } from "./normalize.js";

const LEGAL_SUFFIXES = new Set(["inc", "llc", "ltd", "corp", "corporation", "co", "gmbh", "plc"]);

/** Normalizes a company name for matching by lowercasing it and stripping a trailing legal suffix. */
export function normalizeCompany(name: string): string {
  const words = normalizeTitle(name).split(" ");
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1) ?? "")) words.pop();
  return words.join(" ");
}

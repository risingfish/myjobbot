import { z } from "zod";

export const optionalText = z.string().nullish().transform((value) => value ?? null);
export const optionalDate = z.union([z.string(), z.number()]).nullish().transform(toIsoOrNull);
export const optionalFlag = z.boolean().nullish().transform((value) => value ?? null);
export const textList = z
  .union([z.array(z.string()), z.string().transform((value) => value.split(","))])
  .nullish()
  .catch(null)
  .transform((value) => value ?? []);

/** Parses a date-like value into an ISO timestamp string, or null if it can't be parsed. */
function toIsoOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

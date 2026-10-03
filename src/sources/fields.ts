import { z } from "zod";

export const optionalText = z.string().nullish().transform((value) => value ?? null);
export const optionalDate = z.union([z.string(), z.number()]).nullish().transform(toIsoOrNull);
export const optionalFlag = z.boolean().nullish().transform((value) => value ?? null);

function toIsoOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

import { z } from "zod";

export const jsonList = z
  .string()
  .nullable()
  .transform((value) => (value === null ? [] : JSON.parse(value)))
  .pipe(z.array(z.string()));

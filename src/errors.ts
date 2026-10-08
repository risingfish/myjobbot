import { z } from "zod";

/** Formats any thrown value into a readable message, giving Zod validation errors special treatment. */
export function describeError(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  if (error instanceof Error) return error.message;
  return String(error);
}

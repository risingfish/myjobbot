import { createHash } from "node:crypto";

export function jsearchId(rawId: string): string {
  return `js_${createHash("sha256").update(rawId).digest("hex").slice(0, 16)}`;
}

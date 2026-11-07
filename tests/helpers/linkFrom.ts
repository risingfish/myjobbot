import type { MemoryMailer } from "./memoryMailer.js";

export function linkFrom(mailer: MemoryMailer, purpose: string): string {
    const match = [...mailer.sent].reverse().map((mail) => mail.text.match(new RegExp(`/link#p=${purpose}&t=([A-Za-z0-9_-]{43})`))).find((found) => found !== null);
    if (!match?.[1]) throw new Error(`no ${purpose} link mailed`);
    return match[1];
}

import type { DescriptionFormat } from "../jobs/job.js";

const MAX_DESCRIPTION_CHARS = 20_000;

/** Keeps a description within the stored limit, cutting Markdown at a line break so no line or link is cut in half. */
export function capDescription(text: string, format: DescriptionFormat): string {
    if (text.length <= MAX_DESCRIPTION_CHARS) return text;
    const cut = text.slice(0, MAX_DESCRIPTION_CHARS);
    const lastBreak = cut.lastIndexOf("\n");
    return format === "markdown" && lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
}

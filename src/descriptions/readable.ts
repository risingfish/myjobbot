import type { DescriptionFormat } from "../jobs/job.js";

const LINK = /(?<!\\)\[((?:\\.|[^\\\]])*)\]\([^()\s]*\)/g;

/** Gives the description the model and title boosts read: a Markdown one keeps each link's words but not its address. */
export function readableDescription(description: string | null, format: DescriptionFormat | null): string | null {
    if (description === null || format !== "markdown") return description;
    return description.replace(LINK, "$1");
}

import { readableDescription } from "../descriptions/readable.js";
import type { DescriptionFormat } from "../jobs/job.js";
import type { PageLink } from "./fitPage.js";

export interface Posting {
    title: string;
    location: string | null;
    url: string;
    postingId: string;
    description: string | null;
    format: DescriptionFormat;
}

export interface StoredDescription {
    text: string;
    format: DescriptionFormat;
}

export interface Shown {
    text: string;
    links: PageLink[];
    note?: string;
    description: StoredDescription | null;
}

const NO_LONGER_LISTED = "this posting is no longer listed";

/** Shows one posting as a job page: its title, location and readable description for the model, and the description to store, or an empty page when it is gone. */
export function postingPage(found: Posting | null): Shown {
    if (found === null) return { text: "", links: [], note: NO_LONGER_LISTED, description: null };
    const description = storedDescription(found);
    const readable = readableDescription(description?.text ?? null, found.format) ?? "";
    const text = [found.title, found.location ?? "", "", readable]
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { text, links: [], description };
}

/** Gives a posting's own description in its own format, or null when it has none worth storing. */
function storedDescription(found: Posting): StoredDescription | null {
    const { description, format } = found;
    return description === null || description.trim() === "" ? null : { text: description, format };
}

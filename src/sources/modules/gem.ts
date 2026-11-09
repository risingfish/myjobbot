import { z } from "zod";
import { markdownDescription } from "../../descriptions/toMarkdown.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { optionalDate, optionalText } from "../fields.js";
import { slugAndPosting, slugBoard } from "./slugBoard.js";

const posting = z.object({
    id: z.string(),
    title: z.string(),
    absolute_url: z.string(),
    location: z.object({ name: optionalText }).nullish(),
    first_published_at: optionalDate,
    content: optionalText,
});

export const gem = slugBoard({
    id: "gem",
    name: "Gem",
    description: "A company's job board on Gem.",
    origin: "https://jobs.gem.com",
    url: (slug) => `https://api.gem.com/job_board/v0/${encodeURIComponent(slug)}/job_posts/`,
    postings: z.array(posting),
    toJob,
    link: gemLink,
});

/** Reads a Gem board address, the public board's or its data address, or gives null for another host. */
function gemLink(url: URL, parts: string[]): { slug: string; postingId: string | null } | null {
    if (url.hostname === "jobs.gem.com") return slugAndPosting(parts);
    return url.hostname === "api.gem.com" ? apiLink(parts) : null;
}

/** Reads a Gem job board data address shaped /job_board/v0/<slug>[/...], naming the board only. */
function apiLink([api, version, slug]: string[]): { slug: string; postingId: null } | null {
    return api === "job_board" && version === "v0" && slug !== undefined ? { slug, postingId: null } : null;
}

/** Converts a Gem posting into the shared Job record, converting its raw HTML description to Markdown. */
function toJob(company: string, post: z.infer<typeof posting>): Job {
    return makeJob(
        { ats: "gem", jobId: post.id, company, title: post.title, url: post.absolute_url },
        {
            location: post.location?.name ?? null,
            postedAt: post.first_published_at,
            ...markdownDescription(post.content),
        },
    );
}

import { z } from "zod";
import { markdownDescription } from "../../descriptions/toMarkdown.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { optionalDate, optionalText } from "../fields.js";
import { slugBoard } from "./slugBoard.js";

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
});

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

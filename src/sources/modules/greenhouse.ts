import { z } from "zod";
import { markdownDescription } from "../../descriptions/toMarkdown.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { optionalDate, optionalText } from "../fields.js";
import { decodeEntities } from "../htmlText.js";
import { slugBoard } from "./slugBoard.js";

const posting = z.object({
    id: z.number(),
    title: z.string(),
    absolute_url: z.string(),
    location: z.object({ name: optionalText }).nullish(),
    first_published: optionalDate,
    content: optionalText,
});
const postings = z.object({ jobs: z.array(posting) }).transform((board) => board.jobs);

const HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);

export const greenhouse = slugBoard({
    id: "greenhouse",
    name: "Greenhouse",
    description: "A company's job board on Greenhouse.",
    origin: "https://job-boards.greenhouse.io",
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`,
    postings,
    toJob,
    link: (url, parts) => (HOSTS.has(url.hostname) ? greenhouseLink(parts) : null),
});

/** Reads a Greenhouse address shaped /<slug>[/jobs/<id>], leaving out its embed pages. */
function greenhouseLink(parts: string[]): { slug: string; postingId: string | null } | null {
    const [slug, jobs, postingId] = parts;
    if (slug === undefined || slug === "embed") return null;
    if (parts.length === 1) return { slug, postingId: null };
    return jobs === "jobs" && postingId !== undefined && parts.length === 3 ? { slug, postingId } : null;
}

/** Converts a Greenhouse posting into the shared Job record, converting its escaped HTML description to Markdown. */
function toJob(company: string, post: z.infer<typeof posting>): Job {
    return makeJob(
        { ats: "greenhouse", jobId: String(post.id), company, title: post.title, url: post.absolute_url },
        {
            location: post.location?.name ?? null,
            postedAt: post.first_published,
            ...markdownDescription(post.content === null ? null : decodeEntities(post.content)),
        },
    );
}

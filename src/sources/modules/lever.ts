import { z } from "zod";
import { markdownDescription } from "../../descriptions/toMarkdown.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { optionalDate, optionalText } from "../fields.js";
import { slugBoard } from "./slugBoard.js";

const categories = z.object({ location: optionalText, team: optionalText, department: optionalText }).nullish();

const posting = z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    createdAt: optionalDate,
    workplaceType: optionalText,
    description: optionalText,
    lists: z.array(z.object({ text: z.string(), content: z.string() })).nullish(),
    additional: optionalText,
    categories,
});
const postings = z.array(posting);

export const lever = slugBoard({
    id: "lever",
    name: "Lever",
    description: "A company's job board on Lever.",
    origin: "https://jobs.lever.co",
    url: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    postings,
    toJob,
});

type Posting = z.infer<typeof posting>;

/** Converts a Lever posting into the shared Job record, including department/team/location categories and its whole posting as Markdown. */
function toJob(company: string, post: Posting): Job {
    const details = { ...post.categories, workplaceType: post.workplaceType, postedAt: post.createdAt, ...markdownDescription(postingHtml(post)) };
    return makeJob({ ats: "lever", jobId: post.id, company, title: post.text, url: post.hostedUrl }, details);
}

/** Puts a Lever posting back together as one HTML page: its opening, then each list under its own heading, then its closing section. */
function postingHtml(post: Posting): string | null {
    const lists = (post.lists ?? []).map((list) => `<h3>${escapeHtml(list.text)}</h3><ul>${list.content}</ul>`);
    const parts = [post.description, ...lists, post.additional].filter((part) => part !== null && part !== undefined);
    return parts.length === 0 ? null : parts.join("");
}

/** Escapes a list's plain-text heading so its characters show as written inside the rebuilt HTML. */
function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

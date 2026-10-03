import { z } from "zod";
import { makeJob, type Job } from "../jobs/job.js";
import { defineBoard } from "./board.js";
import { optionalDate, optionalText } from "./fields.js";

const posting = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  location: z.object({ name: optionalText }).nullish(),
  first_published: optionalDate,
});
const postings = z.object({ jobs: z.array(posting) }).transform((board) => board.jobs);

export const fetchGreenhouse = defineBoard({
  url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
  postings,
  toJob,
});

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "greenhouse", jobId: String(post.id), company, title: post.title, url: post.absolute_url },
    { location: post.location?.name ?? null, postedAt: post.first_published },
  );
}

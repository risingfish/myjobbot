import { z } from "zod";
import { makeJob, type Job } from "../jobs/job.js";
import { defineBoard } from "./board.js";
import { optionalDate, optionalText } from "./fields.js";

const categories = z.object({ location: optionalText, team: optionalText, department: optionalText }).nullish();

const posting = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  createdAt: optionalDate,
  workplaceType: optionalText,
  descriptionPlain: optionalText,
  categories,
});
const postings = z.array(posting);

export const fetchLever = defineBoard({
  url: (slug) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  postings,
  toJob,
});

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "lever", jobId: post.id, company, title: post.text, url: post.hostedUrl },
    { ...post.categories, workplaceType: post.workplaceType, postedAt: post.createdAt, description: post.descriptionPlain },
  );
}

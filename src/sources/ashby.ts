import { z } from "zod";
import { makeJob, type Job } from "../jobs/job.js";
import { defineBoard } from "./board.js";
import { optionalDate, optionalFlag, optionalText } from "./fields.js";

const posting = z.object({
  id: z.string(),
  title: z.string(),
  jobUrl: z.string(),
  department: optionalText,
  team: optionalText,
  location: optionalText,
  isRemote: optionalFlag,
  workplaceType: optionalText,
  publishedAt: optionalDate,
  descriptionPlain: optionalText,
  isListed: optionalFlag,
  compensation: z.object({ compensationTierSummary: optionalText }).nullish(),
});
const postings = z.object({ jobs: z.array(posting) }).transform((board) => board.jobs);

export const fetchAshby = defineBoard({
  url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`,
  postings,
  toJob,
  keep: (post) => post.isListed !== false,
});

/** Converts an Ashby posting into the shared Job record, keeping compensation and workplace fields. */
function toJob(company: string, post: z.infer<typeof posting>): Job {
  const { department, team, location, isRemote, workplaceType } = post;
  const compensation = post.compensation?.compensationTierSummary ?? null;
  return makeJob(
    { ats: "ashby", jobId: post.id, company, title: post.title, url: post.jobUrl },
    { department, team, location, isRemote, workplaceType, compensation, postedAt: post.publishedAt, description: post.descriptionPlain },
  );
}

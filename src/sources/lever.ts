import { z } from "zod";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalText } from "./fields.js";
import type { BoardRef } from "./types.js";

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

export async function fetchLever(ref: BoardRef, http: JsonGetter): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(ref.slug)}?mode=json`;
  const postings = z.array(posting).parse(await http.getJson(url));
  return postings.map((post) => toJob(ref.name, post));
}

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "lever", jobId: post.id, company, title: post.text, url: post.hostedUrl },
    { ...post.categories, workplaceType: post.workplaceType, postedAt: post.createdAt, description: post.descriptionPlain },
  );
}

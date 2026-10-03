import { z } from "zod";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalText } from "./fields.js";
import type { BoardRef } from "./types.js";

const posting = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  location: z.object({ name: optionalText }).nullish(),
  first_published: optionalDate,
});
const board = z.object({ jobs: z.array(posting) });

export async function fetchGreenhouse(ref: BoardRef, http: JsonGetter): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(ref.slug)}/jobs`;
  const { jobs } = board.parse(await http.getJson(url));
  return jobs.map((post) => toJob(ref.name, post));
}

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "greenhouse", jobId: String(post.id), company, title: post.title, url: post.absolute_url },
    { location: post.location?.name ?? null, postedAt: post.first_published },
  );
}

import { createHash } from "node:crypto";
import { z } from "zod";
import type { FileConfig } from "../config/schema.js";
import { describeError } from "../errors.js";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalFlag, optionalText } from "./fields.js";

type Search = FileConfig["searches"][number];
type JsearchSettings = FileConfig["jsearch"];

const ENDPOINT = "https://api.openwebninja.com/jsearch/search-v2";

const result = z.object({
  job_id: z.string(),
  employer_name: z.string(),
  job_title: z.string(),
  job_apply_link: z.string(),
  job_city: optionalText,
  job_state: optionalText,
  job_country: optionalText,
  job_is_remote: optionalFlag,
  work_arrangement: optionalText,
  job_salary_string: optionalText,
  job_posted_at_datetime_utc: optionalDate,
  job_description: optionalText,
  job_publisher: optionalText,
});
const response = z.object({ data: z.object({ jobs: z.array(result) }) });
const SHORT_ID_HEX_CHARS = 16;

interface SearchRequest {
  search: Search;
  settings: JsearchSettings;
  apiKey: string;
}

export function searchParams(search: Search, settings: JsearchSettings): Record<string, string> {
  const params: Record<string, string> = { query: search.query, country: search.country, date_posted: settings.date_posted };
  if (search.remote_only) params.work_from_home = "true";
  return params;
}

export async function fetchJsearch(request: SearchRequest, http: JsonGetter): Promise<Job[]> {
  const url = `${ENDPOINT}?${new URLSearchParams(searchParams(request.search, request.settings))}`;
  const body = await withKeyHint(() => http.getJson(url, { "x-api-key": request.apiKey }));
  return response.parse(body).data.jobs.map(toJob);
}

function shortId(rawId: string): string {
  return `js_${createHash("sha256").update(rawId).digest("hex").slice(0, SHORT_ID_HEX_CHARS)}`;
}

async function withKeyHint<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const status = /HTTP (401|403)/.exec(describeError(error))?.[1];
    if (status) {
      throw new Error(`JSearch refused the request (HTTP ${status}); check JSEARCH_API_KEY and that the account is subscribed to JSearch`, { cause: error });
    }
    throw error;
  }
}

function toJob(post: z.infer<typeof result>): Job {
  const location = [post.job_city, post.job_state, post.job_country].filter((part) => part !== null).join(", ") || null;
  return makeJob(
    { ats: "jsearch", jobId: shortId(post.job_id), company: post.employer_name, title: post.job_title, url: post.job_apply_link },
    {
      location, isRemote: post.job_is_remote, workplaceType: post.work_arrangement, compensation: post.job_salary_string,
      postedAt: post.job_posted_at_datetime_utc, description: post.job_description, publisher: post.job_publisher,
    },
  );
}

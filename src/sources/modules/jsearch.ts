import { createHash } from "node:crypto";
import { z } from "zod";
import type { Settings } from "../../config/schema.js";
import { describeError } from "../../errors.js";
import type { JsonGetter } from "../../http/client.js";
import { makeJob, type Job } from "../../jobs/job.js";
import { optionalDate, optionalFlag, optionalText, textList } from "../fields.js";
import { NotSetUp } from "../failure.js";
import type { SourceContext, SourceModule, SourcePage } from "../module.js";

const savedSearch = z.object({ query: z.string().min(1), remote_only: z.boolean().default(false), country: z.string().min(2).default("us") });

type Search = z.infer<typeof savedSearch>;
type JsearchSettings = Settings["jsearch"];

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
    job_highlights: z.object({ Qualifications: textList }).nullish().catch(null),
    required_technologies: textList,
    preferred_technologies: textList,
});
const response = z.object({ data: z.object({ jobs: z.array(result) }) });
const SHORT_ID_HEX_CHARS = 16;

interface SearchRequest {
    search: Search;
    settings: JsearchSettings;
    apiKey: string;
}

export const jsearch: SourceModule<Search> = {
    id: "jsearch",
    name: "JSearch",
    description: "A saved job search across many job boards, through the JSearch API.",
    kind: "api",
    scope: "query",
    params: savedSearch,
    fields: [
        { name: "query", label: "Search", input: "text" },
        { name: "country", label: "Country", input: "text", optional: true, placeholder: "us" },
        { name: "remote_only", label: "Remote only", input: "checkbox", optional: true },
    ],
    requires: ["jsearch_key"],
    limits: { maxJobsPerRun: null, refresh: "jsearch_refresh_hours" },
    suggestName: ({ query }) => query,
    target: ({ query, country, remote_only }) => `jsearch:${query}|${country}|${remote_only}`.toLowerCase(),
    fetch: (search, ctx) => searchPages(search, ctx),
};

/** Yields one search's results as one page, which costs one request from the month's JSearch budget. */
async function* searchPages(search: Search, ctx: SourceContext): AsyncGenerator<SourcePage> {
    if (ctx.jsearch === undefined) throw new NotSetUp("JSEARCH_API_KEY is not set");
    yield { jobs: await fetchJsearch({ search, ...ctx.jsearch }, ctx.http), cost: 1, next: null };
}

/** Builds the JSearch query-string parameters for a saved search given its settings. */
function searchParams(search: Search, settings: JsearchSettings): Record<string, string> {
    const params: Record<string, string> = { query: search.query, country: search.country, date_posted: settings.date_posted };
    if (search.remote_only) params.work_from_home = "true";
    return params;
}

/** Queries the JSearch API for a saved search and maps the results into Jobs. */
export async function fetchJsearch(request: SearchRequest, http: JsonGetter): Promise<Job[]> {
    const url = `${ENDPOINT}?${new URLSearchParams(searchParams(request.search, request.settings))}`;
    const body = await withKeyHint(() => http.getJson(url, { "x-api-key": request.apiKey }));
    return response.parse(body).data.jobs.map(toJob);
}

/** Derives a short, stable job id by hashing JSearch's raw id. */
function shortId(rawId: string): string {
    return `js_${createHash("sha256").update(rawId).digest("hex").slice(0, SHORT_ID_HEX_CHARS)}`;
}

/** Runs a JSearch call, rewording an auth failure into a hint to check the API key and subscription. */
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

/** Converts a JSearch result into the shared Job record, keeping compensation, skills, and requirements. */
function toJob(post: z.infer<typeof result>): Job {
    const location = [post.job_city, post.job_state, post.job_country].filter((part) => part !== null).join(", ") || null;
    return makeJob(
        { ats: "jsearch", jobId: shortId(post.job_id), company: post.employer_name, title: post.job_title, url: post.job_apply_link },
        {
            location,
            isRemote: post.job_is_remote,
            workplaceType: post.work_arrangement,
            compensation: post.job_salary_string,
            postedAt: post.job_posted_at_datetime_utc,
            description: post.job_description,
            publisher: post.job_publisher,
            requirements: post.job_highlights?.Qualifications,
            skills: post.required_technologies,
            preferredSkills: post.preferred_technologies,
        },
    );
}

import type { Message } from "../agent/llm.js";
import { scrubText, type DataMarkers } from "../agent/markers.js";
import { dataSentence } from "../agent/prompt.js";
import type { SoughtJob } from "./session.js";

export const LOOKUP_NUDGE = "Respond only with tool calls: search_careers, open_link or finish_lookup.";
export const LOOKUP_COMPACTION = "Earlier pages were removed to save context. Continue with open_link, or call finish_lookup.";

const SYSTEM = `You find the posting for one job on the employer's own website. The job you are looking for is given between the same markers as the tool results.
Tools:
- search_careers: search the web for the employer's careers page. Results are numbered links.
- open_link: open a numbered link. Say whether you expect a careers page (a list of jobs) or the job's own page.
- finish_lookup: end the lookup.
Steps:
1. If a remembered careers page is offered, open it; otherwise call search_careers.
2. If a result is clearly this job's own page on the employer's site or its job board, open it as job_page.
   Otherwise open the employer's careers page as careers_page; avoid aggregators (LinkedIn, Indeed, Glassdoor, Built In).
3. On a careers page, open the link whose job best matches the title and location as job_page.
4. When a job page describes this job, call finish_lookup with found. If nothing matches, finish with the reason.
If open_link answers opened: false, that page couldn't be read; open another link or finish.
{data}`;

/** Builds the opening messages of one job's lookup conversation, with the job given inside the run's markers, and counts the look-alikes removed from it. */
export function lookupMessages(job: SoughtJob, remembered: string | null, markers: DataMarkers): { messages: Message[]; removed: number } {
    const location = job.location === null ? "" : `, ${job.location}`;
    const lines = [`${job.title} at ${job.company}${location}`, ...(remembered === null ? [] : [`Remembered careers page: [1] ${remembered}`])];
    const scrubbed = scrubText(lines.join("\n"));
    const messages: Message[] = [
        { role: "system", content: SYSTEM.replace("{data}", dataSentence(markers)) },
        { role: "user", content: `Find the posting for:\n${markers.open}\n${scrubbed.text}\n${markers.close}` },
    ];
    return { messages, removed: scrubbed.removed };
}

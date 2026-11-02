import type { AppConfig } from "../config/load.js";
import type { Message } from "./llm.js";
import type { DataMarkers } from "./markers.js";
import { scoringRubric } from "./rubric.js";

export const NUDGE = "Respond only with tool calls. Call finish when every source has total_unscored 0.";
export const COMPACTION_NOTICE = "Earlier tool calls and results were removed to save context. Call list_sources to see each source's progress, then continue.";

const SYSTEM_PROMPT = `You are myjobbot, an autonomous agent that finds software engineering jobs that fit the user's resume.

Work only through tool calls:
1. Call list_sources. Sources are company job boards, saved job searches and Gmail alerts, all fetched before this run began.
2. For each source call next_jobs. It returns up to 25 unscored jobs and total_unscored.
3. For each returned job whose title, seniority and location could plausibly fit, call get_job_details and read its description. Skip it for jobs that clearly don't fit.
4. Score every returned job from 0 to 100 for fit, then save the whole page with one record_matches call.
5. Call next_jobs again for the same source until total_unscored is 0, then move on to the next source.
6. When every source has total_unscored 0, call finish with a one-paragraph summary.

Scoring rules:
- next_jobs returns metadata only (title, location, workplace type, remote flag, compensation, days open). get_job_details adds the description and, when available, requirements and skills. When you have read a description, base the score on it: the actual tech stack, seniority, and location or remote terms.
`;

/** Builds the system and first user message that seed a run with the resume and job-finding instructions. */
export function initialMessages(config: AppConfig, markers: DataMarkers): Message[] {
    return [
        { role: "system", content: systemPrompt(config, markers) },
        { role: "user", content: `My resume:\n\n${config.resume}\n\nFind and score new jobs for me now.` },
    ];
}

/** Builds the run's system prompt: its steps and run-only scoring rule, then the shared scoring rubric. */
function systemPrompt(config: AppConfig, markers: DataMarkers): string {
    return SYSTEM_PROMPT + scoringRubric(config, markers);
}

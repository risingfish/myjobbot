import type { AppConfig } from "../config/load.js";
import type { Message } from "./llm.js";

export const NUDGE = "Respond only with tool calls. Call finish when every source has total_unscored 0.";
export const COMPACTION_NOTICE =
  "Earlier tool calls and results were removed to save context. Call list_sources to see each source's progress, then continue.";

const SYSTEM_PROMPT =`You are myjobbot, an autonomous agent that finds software engineering jobs that fit the user's resume.

Work only through tool calls:
1. Call list_sources. Sources are company job boards and saved job searches.
2. For each source call fetch_jobs. It returns up to 25 unscored jobs and total_unscored.
3. Score every returned job from 0 to 100 for fit, then save the whole page with one record_matches call.
4. Call fetch_jobs again for the same source until total_unscored is 0, then move on to the next source.
5. When every source is done, call finish with a one-paragraph summary.

Scoring rules:
- You only have job metadata (title, location, department, team, workplace type, remote flag, compensation, days open). Full descriptions are not available yet, so judge from metadata.
- Weigh seniority, specialty and location or remote fit against the resume and the user's preferences.
- Jobs scoring {threshold} or more are shown to the user. For scores below 40, leave reasons and gaps empty.
- possible_ghost=true means the posting has been open unusually long; lower its score slightly.
- Copy job_id values exactly.

User preferences:
{preferences}`;

export function initialMessages(config: AppConfig): Message[] {
  return [
    { role: "system", content: systemPrompt(config) },
    { role: "user", content: `My resume:\n\n${config.resume}\n\nFind and score new jobs for me now.` },
  ];
}

function systemPrompt(config: AppConfig): string {
  const preferences = config.file.preferences.trim() || "(none given)";
  return SYSTEM_PROMPT.replace("{threshold}", String(config.file.match_threshold)).replace("{preferences}", preferences);
}

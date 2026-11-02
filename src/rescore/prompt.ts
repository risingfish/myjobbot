import type { Message } from "../agent/llm.js";
import type { DataMarkers } from "../agent/markers.js";
import { scoringRubric } from "../agent/rubric.js";
import type { AppConfig } from "../config/load.js";

export const RESCORE_NUDGE = "Respond only with tool calls: get_job, then record_matches.";
export const RESCORE_COMPACTION_NOTICE = "Earlier tool calls and results were removed to save context. Call get_job again, then save its score with record_matches.";

const STEPS = `You are myjobbot, re-scoring one job against the user's resume.

Work only through tool calls:
1. Call get_job to read the job: its metadata, description and, when available, requirements and skills.
2. Score it from 0 to 100 for fit, then save it with one record_matches call.

Scoring rules:
`;

/** Builds the system and user messages that seed a re-score with the shared scoring rubric and the resume. */
export function rescoreMessages(config: AppConfig, markers: DataMarkers): Message[] {
    return [
        { role: "system", content: STEPS + scoringRubric(config, markers) },
        { role: "user", content: `My resume:\n\n${config.resume}\n\nRe-score the job now.` },
    ];
}

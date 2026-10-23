import type { AgentResult } from "../agent/loop.js";
import type { DescriptionFormat } from "../jobs/job.js";
import { hasText, type LookupReason, type LookupSession } from "./session.js";

type JobPage = NonNullable<LookupSession["jobPage"]>;
type Found = { found: true; description: string; format: DescriptionFormat; url: string; careersUrl: string | null };

export type LookupOutcome = Found | { found: false; reason: LookupReason };

/** Decides how a lookup ended: the description found, the model's reason, or the code's reason when it never finished. */
export function decideOutcome(session: LookupSession, result: AgentResult): LookupOutcome {
    const { finished, jobPage } = session;
    if (finished?.found === true && jobPage !== null && hasText(jobPage.text)) return foundOutcome(session, jobPage);
    if (finished?.reason) return { found: false, reason: finished.reason };
    return { found: false, reason: unfinishedReason(session, result) };
}

/** Describes a found lookup: the job page's own description in its format, or its page text as plain text. */
function foundOutcome(session: LookupSession, jobPage: JobPage): Found {
    const stored = jobPage.description ?? { text: jobPage.text, format: "text" };
    return { found: true, description: stored.text, format: stored.format, url: jobPage.url, careersUrl: session.careersPage?.url ?? null };
}

/** Picks the reason for a lookup that ended without finish_lookup, in the contract's fixed order. */
function unfinishedReason(session: LookupSession, result: AgentResult): LookupReason {
    if (result.reason.startsWith("LLM error") || session.stop !== null) return "lookup_error";
    if (session.lastFailure !== null) return session.lastFailure;
    return unreadablePage(session) ?? (session.searched === 0 && session.opens === 0 ? "no_careers_page" : "gave_up");
}

/** Names the unreadable page a lookup ended on: a careers page with no links or a job page with no text. */
function unreadablePage(session: LookupSession): LookupReason | null {
    if (session.lastOpened === "careers" && session.careersPage?.links === 0) return "careers_page_unreadable";
    if (session.lastOpened === "job" && !hasText(session.jobPage?.text ?? "")) return "job_page_unreadable";
    return null;
}

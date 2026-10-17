import type { AgentResult } from "../agent/loop.js";
import type { LookupReason, LookupSession } from "./session.js";

export type LookupOutcome = { found: true; description: string; url: string; careersUrl: string | null } | { found: false; reason: LookupReason };

/** Decides how a lookup ended: the description found, the model's reason, or the code's reason when it never finished. */
export function decideOutcome(session: LookupSession, result: AgentResult): LookupOutcome {
    const { finished, jobPage } = session;
    if (finished?.found === true && jobPage !== null) return { found: true, description: jobPage.text, url: jobPage.url, careersUrl: session.careersPage?.url ?? null };
    if (finished?.reason) return { found: false, reason: finished.reason };
    return { found: false, reason: unfinishedReason(session, result) };
}

/** Picks the reason for a lookup that ended without finish_lookup, in the contract's fixed order. */
function unfinishedReason(session: LookupSession, result: AgentResult): LookupReason {
    if (result.reason.startsWith("LLM error") || session.stop !== null) return "lookup_error";
    if (session.lastFailure !== null) return session.lastFailure;
    if (session.lastOpened === "careers" && session.careersPage?.links === 0) return "careers_page_unreadable";
    if (session.searched === 0 && session.opens === 0) return "no_careers_page";
    return "gave_up";
}

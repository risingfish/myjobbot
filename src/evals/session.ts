import { randomUUID } from "node:crypto";
import type { ChatFn } from "../agent/llm.js";
import { runAgent } from "../agent/loop.js";
import { dataMarkers, type DataMarkers } from "../agent/markers.js";
import type { Trace, TraceEvent } from "../agent/trace.js";
import { reportLookalike } from "../app/lookalikes.js";
import type { AppConfig } from "../config/load.js";
import { rescoreMessages } from "../rescore/prompt.js";
import { oneJobAgentDeps } from "../rescore/session.js";
import { caseStore, caseTools } from "./caseTools.js";
import { failureOf, type Tally } from "./failure.js";
import type { EvalCase, Profile, Result } from "./format.js";

const PLACEHOLDERS: DataMarkers = { tag: "", open: "{open}", close: "{close}" };

export type Attempt = Pick<Result, "base" | "bonus" | "score" | "reasons" | "gaps" | "failure" | "tokensIn" | "tokensOut" | "ms">;

export interface SessionDeps {
    config: AppConfig;
    makeChat: (responseLog: Trace) => ChatFn;
    trace: Trace;
    template?: string;
}

/** Scores one case once, as a re-score scores one job, with its frozen job inside fresh data markers, and reports the score or why there is none. */
export async function scoreCase(evalCase: EvalCase, profile: Profile, deps: SessionDeps): Promise<Attempt> {
    const config = configFor(deps.config, profile);
    const markers = dataMarkers(randomUUID());
    const responses: TraceEvent[] = [];
    const store = caseStore(evalCase);
    const tally: Tally = { recorded: false, calls: 0, failures: 0 };
    const started = Date.now();
    const onLookalike = (hit: Parameters<typeof reportLookalike>[1]) => reportLookalike({ store, trace: deps.trace, now: () => new Date() }, hit);
    const session = { chat: deps.makeChat({ write: (event) => void responses.push(event) }), trace: deps.trace, tools: caseTools(evalCase, store, tally), settings: config.settings, isFinished: () => store.recorded() !== null, markers, onLookalike };
    const result = await runAgent(oneJobAgentDeps(session), rescoreMessages(config, markers, deps.template));
    const verdict = store.recorded();
    const failure = failureOf(result, { ...tally, recorded: verdict !== null });
    const scored = verdict === null ? { base: null, bonus: null, score: null, reasons: [], gaps: [] } : { base: verdict.base ?? null, bonus: verdict.bonus ?? null, score: verdict.score, reasons: verdict.reasons, gaps: verdict.gaps };
    return { ...scored, failure, ...usageOf(responses), ms: Date.now() - started };
}

/** Gives the system prompt a profile's cases are scored under, from the code's template or a variant's, with the data markers left as placeholders, so equal prompts read the same. */
export function promptFor(config: AppConfig, profile: Profile, template?: string): string {
    const [system] = rescoreMessages(configFor(config, profile), PLACEHOLDERS, template);
    return typeof system?.content === "string" ? system.content : "";
}

/** Swaps the profile's resume, resume profile, preferences and thresholds into the settings, keeping the run's other settings and what the model reads. */
function configFor(config: AppConfig, profile: Profile): AppConfig {
    const settings = { ...config.settings, preferences: profile.preferences, match_threshold: profile.matchThreshold, ghost_threshold_days: profile.ghostThresholdDays };
    return { ...config, resume: profile.resume, profile: profile.resumeProfile ?? null, settings };
}

/** Adds up the tokens the model's responses report, or null when they report none. */
function usageOf(responses: TraceEvent[]): Pick<Attempt, "tokensIn" | "tokensOut"> {
    const usages = responses.flatMap((event) => {
        const usage = (event.response as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | undefined)?.usage;
        return usage === undefined ? [] : [usage];
    });
    if (usages.length === 0) return { tokensIn: null, tokensOut: null };
    return { tokensIn: usages.reduce((sum, usage) => sum + (usage.prompt_tokens ?? 0), 0), tokensOut: usages.reduce((sum, usage) => sum + (usage.completion_tokens ?? 0), 0) };
}

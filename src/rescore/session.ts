import type { ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps } from "../agent/loop.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import { reportLookalike } from "../app/lookalikes.js";
import type { AppConfig } from "../config/load.js";
import type { Settings } from "../config/schema.js";
import type { PostingStore } from "../db/postingStore.js";
import type { JobKey, JobStore } from "../db/store.js";
import type { RescoreLog } from "./log.js";
import { oneJobStore } from "./oneJobStore.js";
import { RESCORE_COMPACTION_NOTICE, RESCORE_NUDGE, rescoreMessages } from "./prompt.js";
import { rescoreTools, type RescoreToolContext } from "./tools.js";

const RESCORE_MAX_STEPS = 6;
const RESCORE_MAX_MINUTES = 3;

interface SessionDeps {
    config: AppConfig;
    store: JobStore;
    postings: PostingStore;
    key: JobKey;
    chat: ChatFn;
    trace: Trace;
    runId: string;
    now: () => Date;
    markers: DataMarkers;
    log: Pick<RescoreLog, "step">;
}

/** Scores one job in its own short agent session, logging the score once it is saved and giving it back, or null when none was. */
export async function scoreOne(deps: SessionDeps): Promise<number | null> {
    let saved: number | null = null;
    const store = oneJobStore(deps.store, deps.key, (score) => {
        saved = score;
        deps.log.step({ kind: "saved", fields: { score } });
    });
    const context = { store, postings: deps.postings, key: deps.key, config: deps.config.settings, now: deps.now, runId: deps.runId };
    await runAgent(agentDeps(deps, context), rescoreMessages(deps.config, deps.markers));
    return saved;
}

/** Assembles the agent loop's dependencies for a re-score: its tools, tight limits and its own nudge and compaction notice. */
function agentDeps(deps: SessionDeps, context: RescoreToolContext): AgentDeps {
    return oneJobAgentDeps({
        chat: deps.chat,
        trace: deps.trace,
        tools: rescoreTools(context),
        settings: deps.config.settings,
        isFinished: () => context.store.recorded(),
        markers: deps.markers,
        onLookalike: (hit) => reportLookalike({ postings: deps.postings, trace: deps.trace, now: deps.now }, hit),
    });
}

export type OneJobSession = Pick<AgentDeps, "chat" | "trace" | "tools" | "isFinished" | "markers" | "onLookalike"> & { settings: Settings };

/** Gives a session that scores one job, a re-score's or an eval case's, the re-score's tight limits, nudge and compaction notice. */
export function oneJobAgentDeps({ settings, ...session }: OneJobSession): AgentDeps {
    const limits = { ...settings.agent, max_steps: RESCORE_MAX_STEPS, max_wall_clock_min: RESCORE_MAX_MINUTES };
    return { ...session, limits, clock: Date.now, nudge: RESCORE_NUDGE, compactionNotice: RESCORE_COMPACTION_NOTICE };
}

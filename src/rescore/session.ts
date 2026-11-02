import type { ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps } from "../agent/loop.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import { reportLookalike } from "../app/lookalikes.js";
import type { AppConfig } from "../config/load.js";
import type { JobKey, JobStore } from "../db/store.js";
import { oneJobStore } from "./oneJobStore.js";
import { RESCORE_COMPACTION_NOTICE, RESCORE_NUDGE, rescoreMessages } from "./prompt.js";
import { rescoreTools, type RescoreToolContext } from "./tools.js";

const RESCORE_MAX_STEPS = 6;
const RESCORE_MAX_MINUTES = 3;

interface SessionDeps {
    config: AppConfig;
    store: JobStore;
    key: JobKey;
    chat: ChatFn;
    trace: Trace;
    runId: string;
    now: () => Date;
    markers: DataMarkers;
}

/** Scores one job in its own short agent session, reporting whether its verdict was saved. */
export async function scoreOne(deps: SessionDeps): Promise<boolean> {
    const store = oneJobStore(deps.store, deps.key);
    const context = { store, key: deps.key, config: deps.config.settings, now: deps.now, runId: deps.runId };
    await runAgent(agentDeps(deps, context), rescoreMessages(deps.config, deps.markers));
    return store.recorded();
}

/** Assembles the agent loop's dependencies for a re-score: its tools, tight limits and its own nudge and compaction notice. */
function agentDeps(deps: SessionDeps, context: RescoreToolContext): AgentDeps {
    return {
        chat: deps.chat,
        trace: deps.trace,
        tools: rescoreTools(context),
        limits: { ...deps.config.settings.agent, max_steps: RESCORE_MAX_STEPS, max_wall_clock_min: RESCORE_MAX_MINUTES },
        clock: Date.now,
        isFinished: () => context.store.recorded(),
        nudge: RESCORE_NUDGE,
        compactionNotice: RESCORE_COMPACTION_NOTICE,
        markers: deps.markers,
        onLookalike: (hit) => reportLookalike({ store: context.store, trace: deps.trace, now: deps.now }, hit),
    };
}

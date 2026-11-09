import { z } from "zod";
import type { ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps } from "../agent/loop.js";
import type { DataMarkers } from "../agent/markers.js";
import type { Trace } from "../agent/trace.js";
import type { Settings } from "../config/schema.js";
import type { ProfileContent, Resume } from "../db/resumeStore.js";
import { defineTool, type Tool } from "../tools/tool.js";
import { dedupedSkills, EXTRACT_FAILED, extractedProfile } from "./profile.js";
import { PROFILE_COMPACTION_NOTICE, PROFILE_NUDGE, profileMessages } from "./prompt.js";

const MAX_STEPS = 4;
const MAX_MINUTES = 3;

export interface ExtractDeps {
    chat: ChatFn;
    trace: Trace;
    markers: DataMarkers;
    limits: Settings["agent"];
    clock: () => number;
}

export type Extracted = { ok: true; profile: ProfileContent } | { ok: false; error: string };

interface Recorded {
    profile: ProfileContent | null;
}

/** Has the model read the resume and record a profile in a short session of its own, giving the profile or a fixed failure. */
export async function extractProfile(resume: Pick<Resume, "text">, deps: ExtractDeps): Promise<Extracted> {
    const recorded: Recorded = { profile: null };
    await runAgent(
        agentDeps(deps, profileTools(resume, recorded), () => recorded.profile !== null),
        profileMessages(deps.markers),
    );
    return recorded.profile === null ? { ok: false, error: EXTRACT_FAILED } : { ok: true, profile: recorded.profile };
}

/** Assembles the extraction's agent loop: its tools, tight limits, own nudge, and look-alike markers traced only, as there is no job to flag. */
function agentDeps(deps: ExtractDeps, tools: Tool[], isFinished: () => boolean): AgentDeps {
    const limits = { ...deps.limits, max_steps: MAX_STEPS, max_wall_clock_min: MAX_MINUTES };
    const onLookalike = () => deps.trace.write({ type: "resume_lookalike" });
    return { chat: deps.chat, tools, limits, trace: deps.trace, clock: deps.clock, isFinished, nudge: PROFILE_NUDGE, compactionNotice: PROFILE_COMPACTION_NOTICE, markers: deps.markers, onLookalike };
}

/** Gives the extraction's model its two tools: get_resume for the resume as data, and record_profile to save the profile it read. */
function profileTools(resume: Pick<Resume, "text">, recorded: Recorded): Tool[] {
    const getResume = defineTool({ name: "get_resume", outsideText: true, description: "Return the user's resume as text.", schema: z.object({}), run: () => ({ text: resume.text }) });
    const recordProfile = defineTool({
        name: "record_profile",
        outsideText: false,
        description: "Save the profile read from the resume: a summary written as the user's job preferences, and each skill once in one group (engineering, people or project).",
        schema: extractedProfile,
        run: ({ summary, skills }) => {
            recorded.profile = { summary, skills: dedupedSkills(skills) };
            return { saved: true };
        },
    });
    return [getResume, recordProfile];
}

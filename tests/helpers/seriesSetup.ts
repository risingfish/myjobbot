import type { AssistantMessage } from "../../src/agent/llm.js";
import type { Trace } from "../../src/agent/trace.js";
import { ExperimentFiles } from "../../src/evals/experimentFiles.js";
import { EvalFiles } from "../../src/evals/files.js";
import { codeTemplateId, formatVariant } from "../../src/evals/variant.js";
import { rescoreSystemTemplate } from "../../src/rescore/prompt.js";
import { toolCallReply } from "./chat.js";
import { testAppConfig } from "./config.js";
import { answerKey, AT, evalCase, profile } from "./evalFixtures.js";
import { memoryFilePort } from "./memoryFilePort.js";
import { usageChat } from "./usageChat.js";

export const STRICT = rescoreSystemTemplate().replace("Scoring rules:", "Scoring rules (strict):");

export function variantFile(text: string): string {
    return formatVariant({ header: { schema: 1, exportedAt: AT, exportedFrom: codeTemplateId(), gitCommit: null }, text });
}

export function scoring(base: number): AssistantMessage[] {
    return [toolCallReply("get_job", {}), toolCallReply("record_matches", { verdicts: [{ job_id: "4012345", base, bonus: 30, reasons: [], gaps: [] }] })];
}

export function seriesSetup(scripts: AssistantMessage[][], extra: Record<string, string> = {}) {
    const seed = { "evals/profiles/p1.json": JSON.stringify(profile()), "evals/cases/greenhouse-4012345.json": JSON.stringify(evalCase()), "evals/answer_keys/greenhouse-4012345.json": JSON.stringify(answerKey()), "evals/variants/strict.md": variantFile(STRICT), ...extra };
    const { port, files } = memoryFilePort(seed);
    const queue = [...scripts];
    const models: string[] = [];
    const lines: string[] = [];
    let draws = 0;
    const chatFor = (model: string) => (log: Trace) => (models.push(model), usageChat(queue.shift() ?? [], { prompt_tokens: 1000, completion_tokens: 50 }).makeChat(log));
    const deps = { files: new EvalFiles(port), experiments: new ExperimentFiles(port), config: testAppConfig(), chatFor, now: () => new Date(AT), random: () => (draws += 0.1) % 1, gitCommit: () => null, print: (line: string) => void lines.push(line) };
    return { files, lines, models, deps };
}

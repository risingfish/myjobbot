import { expect, test } from "vitest";
import { scoreCase } from "../src/evals/session.js";
import { testAppConfig } from "./helpers/config.js";
import { evalCase, parsed, profile } from "./helpers/evalFixtures.js";
import { textReply, toolCallReply } from "./helpers/chat.js";
import { memoryTrace } from "./helpers/trace.js";
import { usageChat } from "./helpers/usageChat.js";

const record = (job_id: string) => toolCallReply("record_matches", { verdicts: [{ job_id, base: 40, bonus: 32, reasons: ["stack"], gaps: ["kafka"] }] });

function run(caseFile: Record<string, unknown>, chat: ReturnType<typeof usageChat>) {
    return scoreCase(parsed("case", caseFile), parsed("profile", profile()), { config: testAppConfig(), makeChat: chat.makeChat, trace: memoryTrace() });
}

test("a model that reads the job and saves a score gives its parts, reasons and gaps, having read the frozen job inside fresh markers", async () => {
    const chat = usageChat([toolCallReply("get_job", {}), record("4012345")], { prompt_tokens: 1000, completion_tokens: 50 });
    const attempt = await run(evalCase(), chat);
    expect([attempt.base, attempt.bonus, attempt.score, attempt.reasons, attempt.gaps, attempt.failure, attempt.tokensIn, attempt.tokensOut]).toEqual([40, 32, 72, ["stack"], ["kafka"], null, 2000, 100]);
    const toolResult = String(chat.requests[1]?.at(-1)?.content);
    const marker = /<<data ([0-9a-f]{12})>>/.exec(toolResult)?.[1];
    expect([toolResult.includes('"days_open":12'), marker !== undefined, marker === "20261103180000"]).toEqual([true, true, false]);
});

test("an alert-only case gets the note a run adds to its gaps", async () => {
    const alertOnly = evalCase({ id: "linkedin-li_44", source: { ats: "linkedin", jobId: "li_44" }, job: { job_id: "li_44", title: "Engineer", days_open: 12, possible_ghost: false, description: "(none provided)" } });
    const attempt = await run(alertOnly, usageChat([toolCallReply("get_job", {}), record("li_44")]));
    expect([attempt.gaps, attempt.tokensIn]).toEqual([["kafka", "scored from the alert only (no description)"], null]);
});

test("a model that never saves a score, or whose every save breaks the tool's rules, fails with that reason", async () => {
    const neverSaves = await run(evalCase(), usageChat(Array.from({ length: 8 }, () => textReply("thinking"))));
    const brokenSaves = await run(evalCase(), usageChat(Array.from({ length: 8 }, () => toolCallReply("record_matches", { verdicts: [{ job_id: "4012345", base: 99 }] }))));
    expect([neverSaves.failure, neverSaves.score, brokenSaves.failure]).toEqual(["no_record", null, "invalid_tool_call"]);
});

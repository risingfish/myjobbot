import { expect, test } from "vitest";
import { profileOf } from "../src/evals/capture.js";
import { parseFile } from "../src/evals/format.js";
import { executeRun } from "../src/evals/runCases.js";
import { runSeries, saveSeries } from "../src/evals/series.js";
import { testAppConfig } from "./helpers/config.js";
import { AT, profile } from "./helpers/evalFixtures.js";
import { scoring, seriesSetup } from "./helpers/seriesSetup.js";

const RESUME_PROFILE = { summary: "Senior backend roles", skills: [{ name: "Kubernetes", group: "engineering" as const }] };
const WITH_PROFILE = { "evals/profiles/p1.json": JSON.stringify(profile({ resumeProfile: RESUME_PROFILE })) };
const OPTIONS = { tags: [], ids: [], repeats: 1, model: undefined, variant: null };

test("capture freezes the stored resume profile into the eval profile, and the profile's id depends on it", () => {
    const without = profileOf(testAppConfig(), AT);
    const withProfile = profileOf({ ...testAppConfig(), profile: RESUME_PROFILE }, AT);
    expect([without.profile.resumeProfile, withProfile.profile.resumeProfile, without.id === withProfile.id]).toEqual([undefined, RESUME_PROFILE, false]);
    expect(parseFile("profile", withProfile.profile).ok).toBe(true);
});

test("a run with the resume and profile view sends the profile's skills and records its view", async () => {
    const { files, deps } = seriesSetup([scoring(40)], WITH_PROFILE);
    const requests: string[] = [];
    const chatFor = (model: string) => (log: Parameters<ReturnType<typeof deps.chatFor>>[0]) => {
        const chat = deps.chatFor(model)(log);
        return async (...args: Parameters<typeof chat>) => (requests.push(String(args[0][1]?.content)), chat(...args));
    };
    const made = await executeRun({ ...OPTIONS, view: "resume_and_profile" }, { ...deps, chatFor });
    expect([made.code, made.run?.view, requests[0]?.includes("Engineering: Kubernetes")]).toEqual([0, "resume_and_profile", true]);
    expect(JSON.parse(files.get(`evals/runs/${made.run?.id}/run.json`) ?? "{}").view).toBe("resume_and_profile");
});

test("a view that reads the resume profile is refused before any model call when a case was captured without one", async () => {
    const { lines, models, deps } = seriesSetup([scoring(40), scoring(40)]);
    const refused = [await executeRun({ ...OPTIONS, view: "profile" }, deps), await executeRun({ ...OPTIONS, view: "resume_and_profile" }, deps)];
    expect([refused.map((each) => each.code), models, lines]).toEqual([[1, 1], [], ["refused view profile: case greenhouse-4012345 was captured without a resume profile", "refused view resume_and_profile: case greenhouse-4012345 was captured without a resume profile"]]);
});

test("a series test names its view after the variant, and its model whole after the @, colons included", async () => {
    const { files, models, deps } = seriesSetup([scoring(40)], WITH_PROFILE);
    expect(await saveSeries(["views", "--test", "both=code+resume_and_profile@llama3:8b"], deps)).toBe(0);
    expect(JSON.parse(files.get("evals/series/views.json") ?? "{}").tests).toEqual([{ label: "both", variant: null, model: "llama3:8b", view: "resume_and_profile" }]);
    expect(await runSeries("views", deps)).toBe(0);
    const [runId] = Object.values(JSON.parse([...files.entries()].find(([path]) => path.startsWith("evals/series-runs/"))?.[1] ?? "{}").runs as Record<string, string>);
    expect([models, JSON.parse(files.get(`evals/runs/${runId}/run.json`) ?? "{}").view]).toEqual([["llama3:8b"], "resume_and_profile"]);
});

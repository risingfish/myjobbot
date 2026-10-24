import { expect, test } from "vitest";
import { appliedRequest } from "../web/lib/appliedRequest.js";
import { jobRowView } from "./helpers/rowFixtures.js";

test("clicking a job not applied to marks it, with no confirmation", () => {
    expect(appliedRequest(jobRowView())).toMatchObject({ applied: true, confirm: null });
});

test("clicking an applied job undoes the mark, once the owner confirms", () => {
    expect(appliedRequest(jobRowView({ applied: true, appliedOn: "2026-10-23T16:40:00.000Z" }))).toMatchObject({ applied: false, confirm: "Mark as not applied?" });
});

test("the request names the job it is for", () => {
    expect(appliedRequest(jobRowView({ ats: "lever", jobId: "x1" }))).toMatchObject({ ats: "lever", jobId: "x1" });
});

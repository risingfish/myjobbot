import { expect, test } from "vitest";
import { makeJob } from "../src/jobs/job.js";

const CORE = { ats: "jsearch" as const, jobId: "js_1", company: "Acme", title: "Backend Engineer", url: "u" };

test("makeJob defaults requirements and skills to empty lists", () => {
  expect(makeJob(CORE, {})).toMatchObject({ requirements: [], skills: [], preferredSkills: [] });
});

test("makeJob trims lists, drops blank entries and caps their size", () => {
  const skills = [" Go ", "", ...Array.from({ length: 80 }, (_, index) => `skill ${index}`)];
  const job = makeJob(CORE, { skills, requirements: ["x".repeat(900)] });
  expect(job.skills[0]).toBe("Go");
  expect(job.skills).toHaveLength(50);
  expect(job.requirements[0]).toHaveLength(500);
});

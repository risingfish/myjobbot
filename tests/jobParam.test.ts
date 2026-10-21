import { expect, test } from "vitest";
import { jobIn, jobParam, withJob } from "../web/lib/jobParam.js";

const KEY = { ats: "greenhouse", jobId: "123" };

const named = (search: string) => jobIn(new URLSearchParams(search));

test("a job parameter names a board and a job, split at the first colon", () => {
    expect(named("?job=greenhouse%3A123")).toEqual(KEY);
    expect(named("?job=jsearch%3Aa%3Ab")).toEqual({ ats: "jsearch", jobId: "a:b" });
    expect(jobParam(KEY)).toBe("greenhouse:123");
});

test.each(["", "?job=", "?job=x", "?job=%3A1", "?job=x%3A"])("%j names no job", (search) => {
    expect(named(search)).toBeNull();
});

test("no search parameters at all, as outside the router, name no job", () => {
    expect(jobIn(null)).toBeNull();
});

test("withJob sets or removes the job in a query string, keeping the other parameters", () => {
    expect(withJob("?sort=1", KEY)).toBe("?sort=1&job=greenhouse%3A123");
    expect(withJob("?sort=1&job=x%3Ay", KEY)).toBe("?sort=1&job=greenhouse%3A123");
    expect(withJob("?sort=1&job=x%3Ay", null)).toBe("?sort=1");
    expect(withJob("", null)).toBe("?");
});

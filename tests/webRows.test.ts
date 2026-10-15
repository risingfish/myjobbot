import { expect, test } from "vitest";
import type { JobViews } from "../src/db/store.js";
import type { JobRowView, PageData } from "../src/web/api.js";
import { loadRows, setHiddenFor } from "../web/lib/rows.js";
import { testFileConfig } from "./helpers/config.js";
import { seededStores } from "./helpers/views.js";

const config = testFileConfig();
const JOB_A = { ats: "greenhouse", jobId: "a" };

function jobRows(data: PageData): JobRowView[] {
    return data.kind === "jobs" ? data.rows : [];
}

async function seededViews(entries: Parameters<typeof seededStores>[0]): Promise<JobViews> {
    return (await seededStores(entries)).jobViews;
}

test("loadRows returns the requested slice of a page", async () => {
    const views = await seededViews(Array.from({ length: 150 }, (_, index) => ({ id: String(index).padStart(3, "0") })));
    const data = await loadRows(views, config, { name: "jobs", offset: 100 });
    expect([data.rows.length, data.nextOffset, data.total]).toEqual([50, null, 150]);
});

test("loadRows refuses an unknown page or a bad offset", async () => {
    const views = await seededViews([{ id: "a" }]);
    const requests = [
        { name: "nope", offset: 0 },
        { name: "jobs", offset: -5 },
        { name: "jobs", offset: 1.5 },
        { name: "jobs", offset: 2_000_000 },
        { name: "jobs", offset: "abc" },
    ];
    for (const request of requests) await expect(loadRows(views, config, request)).rejects.toThrow("Invalid page request");
});

test("loadRows passes on the reason a load failed", async () => {
    const broken = { countAllJobs: () => Promise.reject(new Error("broken <db>")) } as unknown as JobViews;
    await expect(loadRows(broken, config, { name: "jobs", offset: 0 })).rejects.toThrow("broken <db>");
});

test("hiding a job removes it from recommended and marks it in all jobs, and unhiding brings it back", async () => {
    const views = await seededViews([{ id: "a", score: 90 }]);
    expect(await setHiddenFor(views, { ...JOB_A, hidden: true })).toEqual({ ok: true });
    expect((await loadRows(views, config, { name: "recommended", offset: 0 })).rows).toEqual([]);
    expect(jobRows(await loadRows(views, config, { name: "jobs", offset: 0 })).map((job) => [job.jobId, job.hidden])).toEqual([["a", true]]);
    await setHiddenFor(views, { ...JOB_A, hidden: false });
    expect(jobRows(await loadRows(views, config, { name: "recommended", offset: 0 })).map((job) => job.jobId)).toEqual(["a"]);
});

test("hiding an unknown job reports that there is no such job", async () => {
    const views = await seededViews([{ id: "a" }]);
    expect(await setHiddenFor(views, { ats: "greenhouse", jobId: "missing", hidden: true })).toEqual({ ok: false, error: "No such job." });
});

test("a malformed hide request is refused and changes nothing", async () => {
    const views = await seededViews([{ id: "a", score: 90 }]);
    for (const change of [{ ...JOB_A, hidden: "yes" }, { ...JOB_A, ats: "", hidden: true }, null]) {
        await expect(setHiddenFor(views, change)).rejects.toThrow("Invalid hide request");
    }
    expect(jobRows(await loadRows(views, config, { name: "recommended", offset: 0 })).map((job) => job.jobId)).toEqual(["a"]);
});

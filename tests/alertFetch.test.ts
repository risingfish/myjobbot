import { expect, test } from "vitest";
import { AlertsUnavailable, alertsUsability } from "../src/gmail/alertJobs/usable.js";
import { GmailError } from "../src/gmail/imapErrors.js";
import { makeJob } from "../src/jobs/job.js";
import { alertEmail, digest, DIGEST_SENDER, fixtureJob, fixtureJobs, notification, SEARCH_SENDER, searchAlert } from "./helpers/alertEmails.js";
import { alertSetup, connectedStores, fetchAlerts, lookupDeps, NOW } from "./helpers/alertFetchSetup.js";
import { routedHttp } from "./helpers/http.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { memoryStores } from "./helpers/memoryStore.js";

const SEARCH = fixtureJobs(3, 4100000000);
const POISON = { toString: () => "unused" } as unknown as string;
const DIGEST = fixtureJobs(2, 4200000000);

function twoEmails() {
    return [alertEmail(10, SEARCH_SENDER, searchAlert([{ ...fixtureJob(0), extra: "$140K/yr" }, ...SEARCH.slice(1)], "senior engineer")), alertEmail(11, DIGEST_SENDER, digest(DIGEST))];
}

test("new alert emails become stored jobs, counted and traced, with their companies recorded", async () => {
    const tables = newTables();
    const setup = await alertSetup(twoEmails(), {}, await connectedStores(memoryStores(tables)));
    const { deps, stores, trace } = setup;
    const summary = await fetchAlerts(setup, deps);
    expect(summary).toEqual({ emails: 2, jobs_found: 5, stored: 5, seen_again: 0, searches: 0, looked_up: 0, with_description: 0, alert_only: 5, not_understood: 0, unsupported: 0 });
    expect(await stores.jobStore.findJob("li_4100000000")).toMatchObject({ ats: "linkedin", url: "https://www.linkedin.com/jobs/view/4100000000/", compensation: "$140K/yr", company: "Company 0", location: "Boise, ID" });
    expect(trace.events).toEqual([{ type: "alerts", ...summary, lookups: [], not_understood: [] }]);
    expect(tables.companies.length).toBeGreaterThan(0);
    expect(tables.jobs.every((job) => typeof job.company_id === "number")).toBe(true);
});

test("the read marker advances only after storing, and is kept when nothing is new", async () => {
    const first = await alertSetup(twoEmails());
    await fetchAlerts(first, first.deps);
    expect(await first.stores.alerts.state()).toMatchObject({ uid_validity: 7, last_uid: 11 });
    const again = await alertSetup(twoEmails(), {}, first.stores);
    expect((await fetchAlerts(again, again.deps)).emails).toBe(0);
    expect([again.fake.reads[0]?.marker?.last_uid, (await first.stores.alerts.state())?.last_uid]).toEqual([11, 11]);
    const failing = await alertSetup(twoEmails());
    failing.stores.jobStore.upsertAll = () => Promise.reject(new Error("db down"));
    await expect(fetchAlerts(failing, failing.deps)).rejects.toThrow("db down");
    expect(await failing.stores.alerts.state()).toBeNull();
});

test("repeats are stored once, stored alert jobs keep their details, and other sources' jobs aren't copied", async () => {
    const stores = await connectedStores();
    const board = makeJob({ ats: "greenhouse", jobId: "g1", company: "Company 2", title: "Senior Engineer 2", url: "https://x/g1" }, {});
    await stores.jobStore.upsertAll([board], NOW.toISOString(), "Company 2");
    const known = makeJob({ ats: "linkedin", jobId: "li_4100000001", company: "Company 1", title: "Senior Engineer 1", url: "https://x" }, { description: "kept" });
    await stores.jobStore.upsertAll([known], "2026-10-01T00:00:00.000Z", "Gmail alerts");
    const twice = [alertEmail(10, SEARCH_SENDER, searchAlert(SEARCH, "x")), alertEmail(11, DIGEST_SENDER, digest([fixtureJob(0)]))];
    const setup = await alertSetup(twice, {}, stores);
    const { deps } = setup;
    expect(await fetchAlerts(setup, deps)).toMatchObject({ jobs_found: 4, stored: 1, seen_again: 1 });
    expect(await stores.jobStore.findJob("li_4100000001")).toMatchObject({ description: "kept", last_seen: NOW.toISOString() });
    expect(await stores.jobStore.findJob("li_4100000002")).toBeNull();
});

test("mail that yields no jobs is counted, with sender and subject only in the trace", async () => {
    const emails = [alertEmail(10, DIGEST_SENDER, notification()), alertEmail(11, "alert@indeed.com", digest(DIGEST)), alertEmail(12, DIGEST_SENDER, POISON)];
    const setup = await alertSetup(emails);
    const { deps, stores, trace } = setup;
    expect(await fetchAlerts(setup, deps)).toMatchObject({ emails: 3, jobs_found: 0, not_understood: 2, unsupported: 1 });
    expect(trace.events[0]).toMatchObject({
        not_understood: [
            { from: DIGEST_SENDER, subject: "subject 10" },
            { from: DIGEST_SENDER, subject: "subject 12" },
        ],
    });
    expect(await stores.alerts.state()).toMatchObject({ emails_read: 3, jobs_found: 0, not_understood: 2, last_uid: 12 });
});

test("unusable Gmail stops the fetch with a fixed note, and a rejected password needs reconnecting", async () => {
    const note = (promise: Promise<unknown>) =>
        promise.then(
            () => "resolved",
            (error: unknown) => (error instanceof AlertsUnavailable ? error.note : String(error)),
        );
    const unconnected = await alertSetup([], {}, memoryStores());
    expect(await note(fetchAlerts(unconnected, unconnected.deps))).toBe("Gmail not connected");
    expect(await note(fetchAlerts(unconnected, { ...unconnected.deps, key: { status: "missing" } }))).toBe("server key missing");
    const offline = await alertSetup([], { fail: new GmailError("unreachable") });
    expect(await note(fetchAlerts(offline, offline.deps))).toBe("Gmail couldn't be reached");
    const rejected = await alertSetup([], { fail: new GmailError("bad_login") });
    expect(await note(fetchAlerts(rejected, rejected.deps))).toBe("Gmail needs reconnecting");
    expect((await rejected.stores.gmail.connection())?.status).toBe("needs_reconnect");
});

test("Gmail's usability is settled from the stored row and the key alone", async () => {
    const stores = await connectedStores();
    const row = await stores.gmail.connection();
    const setup = await alertSetup([], {}, stores);
    const { deps } = setup;
    const ok = deps.key;
    expect(alertsUsability(row, ok)).toMatchObject({ usable: true, email: "me@example.com", password: "apppassword" });
    expect(alertsUsability(row, { status: "invalid" })).toEqual({ usable: false, note: "server key invalid" });
    expect(alertsUsability(row, { status: "ok", key: Buffer.alloc(32) })).toEqual({ usable: false, note: "server key changed" });
    expect(alertsUsability(row && { ...row, status: "needs_reconnect" }, ok)).toEqual({ usable: false, note: "Gmail needs reconnecting" });
    expect(alertsUsability(null, ok)).toEqual({ usable: false, note: "Gmail not connected" });
});

function jsearchResults(ids: string[]) {
    const jobs = ids.map((id, index) => ({ job_id: `raw-${id}`, employer_name: "Somewhere", job_title: `Role ${index}`, job_apply_link: `https://www.linkedin.com/jobs/view/${id}/`, job_description: `full description ${id}`, required_technologies: ["Go"] }));
    return { "api.openwebninja.com": { data: { jobs } } };
}

test("each alert email is looked up with one JSearch request, filling in the descriptions it finds", async () => {
    const emails = [alertEmail(10, SEARCH_SENDER, searchAlert(fixtureJobs(2, 4100000000), "senior engineer")), alertEmail(11, SEARCH_SENDER, searchAlert([{ ...fixtureJob(0, 4300000000), title: "Account Executive" }], "sales"))];
    const http = routedHttp(jsearchResults(["4100000000"]));
    const setup = await alertSetup(emails);
    const { deps, stores, trace } = setup;
    const summary = await fetchAlerts(setup, { ...deps, lookup: lookupDeps(http) });
    expect(summary).toMatchObject({ stored: 3, searches: 1, looked_up: 2, with_description: 1, alert_only: 2 });
    expect(trace.events[0]?.lookups).toEqual([{ results: 1, linkedin_links: 1, by_id: 1, by_title: 0, hosts: { "www.linkedin.com": 1 } }]);
    expect([http.requests.length, await stores.apiCalls.countSince("jsearch", "2026-10-01T00:00:00.000Z")]).toEqual([1, 1]);
    expect(await stores.jobStore.findJob("li_4100000000")).toMatchObject({ description: "full description 4100000000", description_format: "text", skills: ["Go"] });
});

test("lookups stop at the allowance, and a JSearch failure or missing key leaves jobs scored from the alert", async () => {
    const emails = [alertEmail(10, SEARCH_SENDER, searchAlert(fixtureJobs(1, 4100000000), "a")), alertEmail(11, SEARCH_SENDER, searchAlert(fixtureJobs(1, 4200000000), "b"))];
    const http = routedHttp(jsearchResults(["4200000000"]));
    const limited = await alertSetup(emails);
    expect(await fetchAlerts(limited, { ...limited.deps, lookup: { ...lookupDeps(http), usedThisMonth: 189 } })).toMatchObject({ searches: 1, with_description: 1 });
    expect(http.requests[0]?.url).toContain("query=b");
    const failing = await alertSetup(emails);
    const down = { getJson: () => Promise.reject(new Error("HTTP 500")) };
    expect(await fetchAlerts(failing, { ...failing.deps, lookup: lookupDeps(down) })).toMatchObject({ stored: 2, with_description: 0, alert_only: 2 });
    const keyless = await alertSetup(emails);
    expect(await fetchAlerts(keyless, { ...keyless.deps, lookup: { ...lookupDeps(http), apiKey: null } })).toMatchObject({ searches: 0, alert_only: 2 });
});

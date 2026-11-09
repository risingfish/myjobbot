import { beforeEach, expect, test, vi } from "vitest";
import { makeJob } from "../src/jobs/job.js";
import { makeDataDir } from "./helpers/dataDir.js";
import { memoryStores, type TestStores } from "./helpers/memoryStore.js";

const state = vi.hoisted(() => ({ stores: null as unknown, account: { id: 2, name: "Second", email: "second@example.com", isAdmin: false, deactivatedAt: null, deleteAfter: null } }));

vi.mock("../web/lib/env.js", () => ({ loadRepoEnv: () => {} }));
vi.mock("next/cache.js", () => ({ revalidatePath: () => {} }));
vi.mock("next/server.js", () => ({ after: () => {} }));
vi.mock("../web/lib/database.js", () => ({ openedStores: async () => state.stores, dbLabel: () => "test" }));
vi.mock("../web/lib/currentSession.js", () => ({ currentSession: async () => ({ account: state.account, session: { verifiedAt: new Date().toISOString() } }) }));

const SEEN = "2026-11-08T00:00:00.000Z";
const RUN = "11111111-1111-4111-8111-111111111111";
const KEY = { ats: "greenhouse", jobId: "owned" };

async function ownerData(): Promise<TestStores> {
    const stores = memoryStores();
    await stores.jobStore.upsertAll([makeJob({ ats: "greenhouse", jobId: "owned", company: "Acme", title: "Engineer", url: "u" }, {})], SEEN, "Acme");
    await stores.searchSettings.save({ match_threshold: 50 }, SEEN);
    await stores.gmail.connected({ email: "owner@example.com", sealedPassword: "sealed" }, SEEN);
    await stores.sources.save({ module: "greenhouse", name: "Acme", params: { slug: "acme" }, target: "greenhouse:acme", enabled: true }, SEEN);
    await stores.rescoreLog.begin(KEY, RUN, SEEN);
    return stores;
}

beforeEach(async () => {
    vi.stubEnv("MYJOBBOT_DATA_DIR", makeDataDir());
    state.account = { id: 2, name: "Second", email: "second@example.com", isAdmin: false, deactivatedAt: null, deleteAfter: null };
    state.stores = await ownerData();
});

test("the pages show a second user none of the owner's jobs and their own default settings", async () => {
    const { getUiState } = await import("../web/lib/uiState.js");
    const ui = await getUiState();
    expect([await ui.views.countAllJobs(), ui.config.match_threshold, ui.sourceNames]).toEqual([0, 70, []]);
});

test("a second user's Settings shows no resume, not even the owner's resume file, and none of the owner's Gmail or sources", async () => {
    const { getSettingsState } = await import("../web/lib/settingsState.js");
    const settings = await getSettingsState();
    expect([settings.resume, settings.gmail.email, settings.sources.rows]).toEqual([{ kind: "none" }, null, []]);
});

test("hiding, marking applied and opening another user's job answer as for a job that doesn't exist", async () => {
    const actions = await import("../web/lib/actions.js");
    expect([await actions.setJobHidden("greenhouse", "owned", true), await actions.setJobApplied("greenhouse", "owned", true), await actions.loadJobDetails("greenhouse", "owned")]).toEqual([{ ok: false, error: "No such job." }, { ok: false, error: "No such job." }, null]);
    expect((await (state.stores as TestStores).jobViews.allJobs({ offset: 0, limit: 5 }))[0]).toMatchObject({ hidden: false, applied: false });
});

test("switching or deleting the owner's source as a second user changes nothing of the owner's", async () => {
    const { deleteSource, setSourceEnabled } = await import("../web/lib/sourceActions.js");
    const [owned] = await (state.stores as TestStores).sources.list();
    expect([await setSourceEnabled(owned?.id, false), await deleteSource(owned?.id)]).toEqual([await setSourceEnabled(999, false), await deleteSource(999)]);
    expect((await (state.stores as TestStores).sources.list()).map((source) => source.enabled)).toEqual([true]);
});

test("a second user's Gmail is their own: connecting and disconnecting it leaves the owner's", async () => {
    const { myStores } = await import("../web/lib/myStores.js");
    const { gmail } = await myStores();
    await gmail.connected({ email: "second@example.com", sealedPassword: "sealed-2" }, SEEN);
    await gmail.disconnect();
    expect([(await (state.stores as TestStores).gmail.connection())?.email, (await gmail.connection())?.status]).toEqual(["owner@example.com", "none"]);
});

test("following another user's re-score answers as for a run that doesn't exist", async () => {
    const { GET } = await import("../web/app/api/rescores/[id]/route.js");
    const response = await GET(new Request(`http://localhost/api/rescores/${RUN}`), { params: Promise.resolve({ id: RUN }) });
    expect(response.status).toBe(404);
});

test("an admin who isn't the owner sees none of the owner's data either", async () => {
    state.account = { ...state.account, isAdmin: true, deactivatedAt: null, deleteAfter: null };
    const { getUiState } = await import("../web/lib/uiState.js");
    const ui = await getUiState();
    const { myStores } = await import("../web/lib/myStores.js");
    expect([await ui.views.countAllJobs(), await (await myStores()).gmail.connection(), await ui.rescoreLog.run(RUN)]).toEqual([0, null, null]);
});

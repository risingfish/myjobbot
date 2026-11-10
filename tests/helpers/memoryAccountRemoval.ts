import type { AccountRemoval, RemovalOutcome } from "../../src/db/accountRemoval.js";
import type { AuthTables } from "./memoryAuthTables.js";
import type { Tables } from "./memoryJobViews.js";
import type { RemovalHooks } from "./accountRemovalContract.js";
import type { TestStores } from "./memoryStore.js";

type Dropper = (userId: number) => void;

function dropRows<T>(rows: T[], mine: (row: T) => boolean): void {
    for (let index = rows.length - 1; index >= 0; index -= 1) if (mine(rows[index] as T)) rows.splice(index, 1);
}

export class MemoryAccountRemoval implements AccountRemoval {
    constructor(
        private readonly auth: AuthTables,
        private readonly tables: Tables,
        private readonly droppers: Dropper[],
    ) {}

    async due(now: string): Promise<number[]> {
        const due = this.auth.users.filter((user) => user.deleteAfter !== null && user.deleteAfter <= now);
        return due.sort((left, right) => String(left.deleteAfter).localeCompare(String(right.deleteAfter)) || left.id - right.id).map((user) => user.id);
    }

    async remove(userId: number, now: string): Promise<RemovalOutcome> {
        const user = this.auth.users.find((row) => row.id === userId);
        if (user === undefined) return "gone";
        if (user.deleteAfter === null || user.deleteAfter > now) return "not_due";
        if (user.isAdmin && this.auth.users.filter((row) => row.isAdmin).length === 1) return "last_admin";
        this.dropAuth(userId);
        this.dropTables(userId);
        for (const drop of this.droppers) drop(userId);
        return "deleted";
    }

    private dropAuth(userId: number): void {
        const { auth } = this;
        dropRows(auth.users, (row) => row.id === userId);
        for (const rows of [auth.methods, auth.sessions, auth.events, auth.emailTokens, auth.recoveryCodes] as Array<Array<{ userId: number }>>) dropRows(rows, (row) => row.userId === userId);
        for (const code of auth.codes) Object.assign(code, { createdBy: code.createdBy === userId ? null : code.createdBy, usedBy: code.usedBy === userId ? null : code.usedBy });
    }

    private dropTables(userId: number): void {
        const runs = new Set(this.tables.rescoreRuns.filter((run) => run.userId === userId).map((run) => run.id));
        dropRows(this.tables.userJobs, (row) => row.user_id === userId);
        dropRows(this.tables.verdicts, (row) => row.user_id === userId);
        dropRows(this.tables.rescoreRuns, (run) => run.userId === userId);
        dropRows(this.tables.rescoreSteps, (step) => runs.has(step.runId));
    }
}

function own<T>(rows: T[] | undefined, mine: (row: T) => boolean): number {
    return (rows ?? []).filter(mine).length;
}

function signInRows(stores: TestStores, userId: number): Record<string, number> {
    const auth = stores.memory?.auth;
    const mine = (row: { userId: number }) => row.userId === userId;
    return { methods: own(auth?.methods, mine), sessions: own(auth?.sessions, mine), events: own(auth?.events, mine), emailTokens: own(auth?.emailTokens, mine), recoveryCodes: own(auth?.recoveryCodes, mine), ...(stores.memory?.keys.heldFor(userId) ?? { keys: 0, challenges: 0 }) };
}

async function dataRows(stores: TestStores, tables: Tables, userId: number): Promise<Record<string, number>> {
    const mine = stores.forUser(userId);
    const present = (value: unknown) => (value === null || value === undefined ? 0 : 1);
    const stored = { sources: (await mine.sources.list()).length, settings: present(await mine.searchSettings.load()), resume: present(await mine.resume.currentResume()), profile: present(await mine.resume.profile()), gmail: present((await mine.gmail.connection())?.email), alerts: present(await mine.alerts.state()) };
    return { userJobs: own(tables.userJobs, (row) => row.user_id === userId), verdicts: own(tables.verdicts, (row) => row.user_id === userId), rescoreRuns: own(tables.rescoreRuns, (run) => run.userId === userId), ...stored };
}

export function memoryRemovalHooks(currentTables: () => Tables): (stores: TestStores) => RemovalHooks {
    return (stores) => {
        const auth = stores.memory?.auth;
        return {
            userRows: async (userId) => ({ ...signInRows(stores, userId), ...(await dataRows(stores, currentTables(), userId)) }),
            sharedCounts: async () => ({ jobs: currentTables().jobs.length, companies: currentTables().companies.length, calls: currentTables().calls.length, codes: auth?.codes.length ?? 0, attempts: auth?.attempts.length ?? 0 }),
            codes: async () => (auth?.codes ?? []).map((code) => ({ createdBy: code.createdBy, usedBy: code.usedBy })),
        };
    };
}

import { splitSettings } from "../../src/config/searchSettings.js";
import { OWNER_ID, userSearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import { MemoryResumeStore } from "./memoryResumeStore.js";
import { userResumeStore } from "../../src/db/resumeStore.js";
import { userSourceStore } from "../../src/db/sourceStore.js";
import type { ApiCallLog, SharedStores, Stores } from "../../src/db/store.js";
import type { UserStores } from "../../src/db/userStores.js";
import { MemoryAccountStore } from "./memoryAccountStore.js";
import { MemoryAlertStore } from "./memoryAlertStore.js";
import { newAuthTables } from "./memoryAuthTables.js";
import { MemoryAuthenticatorStore } from "./memoryAuthenticatorStore.js";
import { MemoryKeyStore } from "./memoryKeyStore.js";
import { MemoryMethodStore } from "./memoryMethodStore.js";
import { MemorySessionStore } from "./memorySessionStore.js";
import { MemoryTokenStore } from "./memoryTokenStore.js";
import { MemoryCompanyStore } from "./memoryCompanyStore.js";
import { MemoryCareersStore } from "./memoryCareersStore.js";
import { MemoryGmailStore } from "./memoryGmailStore.js";
import { MemoryRescoreLog } from "./memoryRescoreLog.js";
import { MemorySearchSettingsStore } from "./memorySearchSettingsStore.js";
import { MemorySourceStore } from "./memorySourceStore.js";
import { savedSources, type SourceLists } from "./savedSources.js";
import { asc, MemoryJobViews, newTables, type Tables } from "./memoryJobViews.js";
import { MemoryJobStore } from "./memoryJobStore.js";
import { MemoryPostingStore } from "./memoryPostingStore.js";

class MemoryApiCallLog implements ApiCallLog {
    constructor(private readonly tables: Tables) {}

    async record(api: string, source: string, calledAt: string): Promise<void> {
        this.tables.calls.push({ api, source, called_at: calledAt });
    }

    async lastCallAt(api: string, source: string): Promise<string | null> {
        const times = this.tables.calls.filter((call) => call.api === api && call.source === source).map((call) => String(call.called_at));
        return times.sort(asc).at(-1) ?? null;
    }

    async countSince(api: string, since: string): Promise<number> {
        return this.tables.calls.filter((call) => call.api === api && String(call.called_at) >= since).length;
    }

    async pruneBefore(cutoff: string): Promise<void> {
        this.tables.calls = this.tables.calls.filter((call) => String(call.called_at) >= cutoff);
    }
}

export type TestStores = Stores & UserStores & { memory?: PerCallStores };

export function withOwner(stores: Stores): TestStores {
    return { ...stores, ...stores.forUser(OWNER_ID), forUser: stores.forUser, close: stores.close };
}

function sharedMemoryStores(tables: Tables): SharedStores {
    const auth = newAuthTables();
    return { sessions: new MemorySessionStore(auth), accounts: new MemoryAccountStore(auth), methods: new MemoryMethodStore(auth), authenticators: new MemoryAuthenticatorStore(auth), tokens: new MemoryTokenStore(auth), keys: new MemoryKeyStore(auth), apiCalls: new MemoryApiCallLog(tables), careers: new MemoryCareersStore(tables), companies: new MemoryCompanyStore(tables), postings: new MemoryPostingStore(tables) };
}

export function memoryStores(tables: Tables = newTables(), perCall: PerCallStores = { sources: new MemorySourceStore(tables), searchSettings: new MemorySearchSettingsStore(), resume: new MemoryResumeStore() }): TestStores {
    const shared = sharedMemoryStores(tables);
    const mailboxes = new Map<number, { gmail: MemoryGmailStore; alerts: MemoryAlertStore }>();
    const mailbox = (userId: number) => {
        const found = mailboxes.get(userId) ?? { gmail: new MemoryGmailStore(), alerts: new MemoryAlertStore() };
        mailboxes.set(userId, found);
        return found;
    };
    const forUser = (userId: number): UserStores => ({ ...shared, userId, ...mailbox(userId), jobStore: new MemoryJobStore(tables, userId), jobViews: new MemoryJobViews(tables, userId), rescoreLog: new MemoryRescoreLog(tables, userId), sources: userSourceStore(perCall.sources, userId), searchSettings: userSearchSettingsStore(perCall.searchSettings, userId), resume: userResumeStore(perCall.resume, userId) });
    return { ...withOwner({ ...shared, forUser, close: async () => {} }), memory: perCall };
}

interface PerCallStores {
    sources: MemorySourceStore;
    searchSettings: MemorySearchSettingsStore;
    resume: MemoryResumeStore;
}

export function storesWithSettings(config: SourceLists, tables: Tables = newTables()): TestStores {
    const searchSettings = new MemorySearchSettingsStore();
    searchSettings.put(OWNER_ID, splitSettings(config).search);
    const sources = new MemorySourceStore(tables);
    sources.seed(OWNER_ID, savedSources(config));
    return memoryStores(tables, { sources, searchSettings, resume: new MemoryResumeStore() });
}

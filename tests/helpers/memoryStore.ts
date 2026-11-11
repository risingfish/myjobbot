import { splitSettings } from "../../src/config/searchSettings.js";
import { OWNER_ID } from "../../src/db/owner.js";
import { userSearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import { MemoryResumeStore } from "./memoryResumeStore.js";
import { userResumeStore } from "../../src/db/resumeStore.js";
import { userSourceStore } from "../../src/db/sourceStore.js";
import type { ApiCallLog } from "../../src/db/apiCallLog.js";
import type { SharedStores, Stores } from "../../src/db/store.js";
import type { UserStores } from "../../src/db/userStores.js";
import { MemoryAccountStore } from "./memoryAccountStore.js";
import { MemoryAlertStore } from "./memoryAlertStore.js";
import { memoryUser, newAuthTables, type AuthTables } from "./memoryAuthTables.js";
import { MemoryAuthenticatorStore } from "./memoryAuthenticatorStore.js";
import { MemoryAccountRemoval } from "./memoryAccountRemoval.js";
import { MemoryKeyStore } from "./memoryKeyStore.js";
import { MemoryMethodStore } from "./memoryMethodStore.js";
import { MemoryAttemptStore } from "./memoryAttemptStore.js";
import { MemorySecurityEventLog } from "./memorySecurityEventLog.js";
import { MemorySessionStore } from "./memorySessionStore.js";
import { MemoryAccountCodeStore } from "./memoryAccountCodeStore.js";
import { MemoryEmailLinkStore } from "./memoryEmailLinkStore.js";
import { MemoryRecoveryCodeStore } from "./memoryRecoveryCodeStore.js";
import { MemoryCompanyStore } from "./memoryCompanyStore.js";
import { MemoryCareersStore } from "./memoryCareersStore.js";
import { MemoryGmailStore } from "./memoryGmailStore.js";
import { MemoryRescoreLog } from "./memoryRescoreLog.js";
import { MemorySearchSettingsStore } from "./memorySearchSettingsStore.js";
import { MemorySourceStore } from "./memorySourceStore.js";
import { savedSources, type SourceLists } from "./savedSources.js";
import { MemoryJobViews, newTables, type Tables } from "./memoryJobViews.js";
import { MemoryJobStore } from "./memoryJobStore.js";
import { MemoryPostingStore } from "./memoryPostingStore.js";
import { MemorySourcePlans } from "./memorySourcePlans.js";
import { MemoryFetchHistory, MemoryMailLog, MemoryRunHistory } from "./memoryMonitoring.js";
import { userFetchHistory } from "../../src/db/fetchHistory.js";

class MemoryApiCallLog implements ApiCallLog {
    constructor(private readonly tables: Tables) {}

    async record(api: string, source: string, calledAt: string): Promise<void> {
        this.tables.calls.push({ api, source, called_at: calledAt });
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

function sharedMemoryStores(tables: Tables, { auth, sources, keys, runHistory, fetchHistory, mailLog }: PerCallStores): SharedStores {
    return { sessions: new MemorySessionStore(auth), attempts: new MemoryAttemptStore(auth), accounts: new MemoryAccountStore(auth), events: new MemorySecurityEventLog(auth), methods: new MemoryMethodStore(auth), authenticators: new MemoryAuthenticatorStore(auth), accountCodes: new MemoryAccountCodeStore(auth), emailLinks: new MemoryEmailLinkStore(auth), recoveryCodes: new MemoryRecoveryCodeStore(auth), keys, apiCalls: new MemoryApiCallLog(tables), careers: new MemoryCareersStore(tables), companies: new MemoryCompanyStore(tables), postings: new MemoryPostingStore(tables), sourcePlans: new MemorySourcePlans(sources), runHistory, fetchHistory, mailLog };
}

export function perCallStores(tables: Tables, auth: AuthTables = newAuthTables()): PerCallStores {
    return { auth, sources: new MemorySourceStore(tables, auth.users), searchSettings: new MemorySearchSettingsStore(auth.users), resume: new MemoryResumeStore(auth.users), keys: new MemoryKeyStore(auth), runHistory: new MemoryRunHistory(), fetchHistory: new MemoryFetchHistory(), mailLog: new MemoryMailLog() };
}

export function memoryStores(tables: Tables = newTables(), perCall: PerCallStores = perCallStores(tables)): TestStores {
    const shared = sharedMemoryStores(tables, perCall);
    const mailboxes = new Map<number, { gmail: MemoryGmailStore; alerts: MemoryAlertStore }>();
    const mailbox = (userId: number) => {
        const found = mailboxes.get(userId) ?? { gmail: new MemoryGmailStore(), alerts: new MemoryAlertStore() };
        mailboxes.set(userId, found);
        return found;
    };
    const forUser = (userId: number): UserStores => ({ ...shared, userId, ...mailbox(userId), jobStore: new MemoryJobStore(tables, userId), jobViews: new MemoryJobViews(tables, userId), rescoreLog: new MemoryRescoreLog(tables, userId), sources: userSourceStore(perCall.sources, userId), searchSettings: userSearchSettingsStore(perCall.searchSettings, userId), resume: userResumeStore(perCall.resume, userId), fetches: userFetchHistory(perCall.fetchHistory, userId) });
    const removal = new MemoryAccountRemoval(perCall.auth, tables, [(userId) => mailboxes.delete(userId), (userId) => perCall.sources.dropUser(userId), (userId) => perCall.searchSettings.dropUser(userId), (userId) => perCall.resume.dropUser(userId), (userId) => perCall.keys.dropUser(userId), (userId) => perCall.runHistory.dropUser(userId), (userId) => perCall.fetchHistory.dropUser(userId)]);
    return { ...withOwner({ ...shared, removal, forUser, close: async () => {} }), memory: perCall };
}

interface PerCallStores {
    auth: AuthTables;
    sources: MemorySourceStore;
    searchSettings: MemorySearchSettingsStore;
    resume: MemoryResumeStore;
    keys: MemoryKeyStore;
    runHistory: MemoryRunHistory;
    fetchHistory: MemoryFetchHistory;
    mailLog: MemoryMailLog;
}

export function storesWithSettings(config: SourceLists, tables: Tables = newTables()): TestStores {
    const perCall = perCallStores(tables);
    perCall.auth.users.push(memoryUser(OWNER_ID));
    perCall.searchSettings.put(OWNER_ID, splitSettings(config).search);
    perCall.sources.seed(OWNER_ID, savedSources(config));
    return memoryStores(tables, perCall);
}

import type { Kysely } from "kysely";
import type { Database } from "../schema.js";
import type { Stores } from "../store.js";
import { KyselyAccountStore } from "./accountStore.js";
import { KyselyAlertStore } from "./alertStore.js";
import { KyselyApiCallLog } from "./apiCalls.js";
import { KyselyCareersStore } from "./careersStore.js";
import { KyselyCompanyStore } from "./companyStore.js";
import { KyselyGmailStore } from "./gmailStore.js";
import { KyselyJobStore } from "./jobStore.js";
import { KyselyJobViews } from "./jobViews.js";
import { KyselyRescoreLogStore } from "./rescoreLogStore.js";
import { KyselyResumeStore } from "./resumeStore.js";
import { KyselySearchSettingsStore } from "./searchSettingsStore.js";
import { KyselyMethodStore } from "./methodStore.js";
import { KyselySessionStore } from "./sessionStore.js";
import { KyselySourceStore } from "./sourceStore.js";
import { KyselyTokenStore } from "./tokenStore.js";

/** Returns the stores that read and write a connected database, closing it when the caller is done. */
export function storesOver(db: Kysely<Database>): Stores {
    return { jobStore: new KyselyJobStore(db), jobViews: new KyselyJobViews(db), apiCalls: new KyselyApiCallLog(db), gmail: new KyselyGmailStore(db), alerts: new KyselyAlertStore(db), careers: new KyselyCareersStore(db), companies: new KyselyCompanyStore(db), searchSettings: new KyselySearchSettingsStore(db), sources: new KyselySourceStore(db), rescoreLog: new KyselyRescoreLogStore(db), resume: new KyselyResumeStore(db), sessions: new KyselySessionStore(db), accounts: new KyselyAccountStore(db), methods: new KyselyMethodStore(db), tokens: new KyselyTokenStore(db), close: () => db.destroy() };
}

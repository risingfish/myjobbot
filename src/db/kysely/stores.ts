import type { Kysely } from "kysely";
import { userResumeStore } from "../resumeStore.js";
import type { Database } from "../schema.js";
import { userSearchSettingsStore } from "../searchSettingsStore.js";
import { userSourceStore } from "../sourceStore.js";
import type { SharedStores, Stores } from "../store.js";
import type { UserStores } from "../userStores.js";
import { KyselyAccountStore } from "./accountStore.js";
import { KyselyAlertStore } from "./alertStore.js";
import { KyselyAuthenticatorStore } from "./authenticatorStore.js";
import { KyselyApiCallLog } from "./apiCalls.js";
import { KyselyCareersStore } from "./careersStore.js";
import { KyselyCompanyStore } from "./companyStore.js";
import { KyselyGmailStore } from "./gmailStore.js";
import { KyselyJobStore } from "./jobStore.js";
import { KyselyJobViews } from "./jobViews.js";
import { KyselyPostingStore } from "./postingStore.js";
import { KyselyRescoreLogStore } from "./rescoreLogStore.js";
import { KyselyResumeStore } from "./resumeStore.js";
import { KyselySearchSettingsStore } from "./searchSettingsStore.js";
import { KyselyKeyStore } from "./keyStore.js";
import { KyselyMethodStore } from "./methodStore.js";
import { KyselySessionStore } from "./sessionStore.js";
import { KyselySourcePlans } from "./sourcePlans.js";
import { KyselySourceStore } from "./sourceStore.js";
import { KyselyTokenStore } from "./tokenStore.js";

/** Returns the stores everyone shares over a connected database. */
function sharedStores(db: Kysely<Database>): SharedStores {
    return { apiCalls: new KyselyApiCallLog(db), careers: new KyselyCareersStore(db), companies: new KyselyCompanyStore(db), postings: new KyselyPostingStore(db), sourcePlans: new KyselySourcePlans(db), sessions: new KyselySessionStore(db), accounts: new KyselyAccountStore(db), methods: new KyselyMethodStore(db), authenticators: new KyselyAuthenticatorStore(db), tokens: new KyselyTokenStore(db), keys: new KyselyKeyStore(db) };
}

/** Returns one user's stores over a connected database, each bound to that user, with the shared stores alongside. */
function userStoresOver(db: Kysely<Database>, shared: SharedStores, userId: number): UserStores {
    const perUser = { jobStore: new KyselyJobStore(db, userId), jobViews: new KyselyJobViews(db, userId), gmail: new KyselyGmailStore(db, userId), alerts: new KyselyAlertStore(db, userId), rescoreLog: new KyselyRescoreLogStore(db, userId) };
    const owned = { sources: userSourceStore(new KyselySourceStore(db), userId), searchSettings: userSearchSettingsStore(new KyselySearchSettingsStore(db), userId), resume: userResumeStore(new KyselyResumeStore(db), userId) };
    return { ...shared, userId, ...perUser, ...owned };
}

/** Returns the stores that read and write a connected database: the shared ones, and each user's through `forUser`; closing it when the caller is done. */
export function storesOver(db: Kysely<Database>): Stores {
    const shared = sharedStores(db);
    return { ...shared, forUser: (userId) => userStoresOver(db, shared, userId), close: () => db.destroy() };
}

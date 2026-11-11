import type { UserFetchHistory } from "./fetchHistory.js";
import type { RescoreLogStore } from "./rescoreLogStore.js";
import type { UserResumeStore } from "./resumeStore.js";
import type { UserSearchSettingsStore } from "./searchSettingsStore.js";
import type { UserSourceStore } from "./sourceStore.js";
import type { AlertStore, GmailStore } from "./gmailStore.js";
import type { JobStore } from "./jobStore.js";
import type { JobViews } from "./jobViews.js";
import type { SharedStores } from "./store.js";

export interface UserStores extends SharedStores {
    userId: number;
    jobStore: JobStore;
    jobViews: JobViews;
    gmail: GmailStore;
    alerts: AlertStore;
    rescoreLog: RescoreLogStore;
    sources: UserSourceStore;
    searchSettings: UserSearchSettingsStore;
    resume: UserResumeStore;
    fetches: UserFetchHistory;
}

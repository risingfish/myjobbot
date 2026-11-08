import { accountContract } from "./helpers/accountContract.js";
import { authenticatorContract } from "./helpers/authenticatorContract.js";
import { userDataContract } from "./helpers/userDataContract.js";
import { userJobContract } from "./helpers/userJobContract.js";
import { keyContract } from "./helpers/keyContract.js";
import { methodContract } from "./helpers/methodContract.js";
import { sessionContract } from "./helpers/sessionContract.js";
import { tokenContract } from "./helpers/tokenContract.js";
import { alertJobContract } from "./helpers/alertJobContract.js";
import { appliedContract } from "./helpers/appliedContract.js";
import { careersStoreContract } from "./helpers/careersStoreContract.js";
import { companyContract } from "./helpers/companyContract.js";
import { memoryCompanyHooks } from "./helpers/memoryCompanies.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { MemoryResumeStore } from "./helpers/memoryResumeStore.js";
import { MemorySourceStore } from "./helpers/memorySourceStore.js";
import { alertStoreContract } from "./helpers/alertStoreContract.js";
import { descriptionContract } from "./helpers/descriptionContract.js";
import { gmailStoreContract } from "./helpers/gmailStoreContract.js";
import { jobDetailContract } from "./helpers/jobDetailContract.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";
import { resumeContract } from "./helpers/resumeContract.js";
import { rescoreContract } from "./helpers/rescoreContract.js";
import { recentContract } from "./helpers/recentContract.js";
import { rescoreLogContract } from "./helpers/rescoreLogContract.js";
import { searchSettingsContract } from "./helpers/searchSettingsContract.js";
import { sourceContract } from "./helpers/sourceContract.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());
sessionContract(async () => memoryStores());
accountContract(async () => memoryStores());
methodContract(async () => memoryStores());
authenticatorContract(async () => memoryStores());
userJobContract(async () => memoryStores(), { seedUsers: async () => {} });
userDataContract(async () => memoryStores(), { seedUsers: async () => {} });
tokenContract(async () => memoryStores());
keyContract(async () => memoryStores());
gmailStoreContract(async () => memoryStores());
alertStoreContract(async () => memoryStores());
alertJobContract(async () => memoryStores());
descriptionContract(async () => memoryStores());
jobDetailContract(async () => memoryStores());
let companyTables = newTables();
companyContract(
    async () => {
        companyTables = newTables();
        return memoryStores(companyTables);
    },
    memoryCompanyHooks(() => companyTables),
);
appliedContract(async () => memoryStores());
rescoreContract(async () => memoryStores());
rescoreLogContract(async () => memoryStores());
recentContract(async () => memoryStores());
resumeContract(async () => memoryStores());
let sourceTables = newTables();
sourceContract(
    async () => {
        sourceTables = newTables();
        return memoryStores(sourceTables);
    },
    { seedCompany: async () => 7, jobLinks: async () => sourceTables.userJobs.map((job) => ({ job_id: String(job.job_id), source: String(job.source), source_id: job.source_id === null ? null : Number(job.source_id) })) },
);
let searchSettings = new MemorySearchSettingsStore();
searchSettingsContract(
    async () => {
        searchSettings = new MemorySearchSettingsStore();
        const tables = newTables();
        return memoryStores(tables, { sources: new MemorySourceStore(tables), searchSettings, resume: new MemoryResumeStore() });
    },
    { owners: async () => searchSettings.users, seedUser: async (id) => void searchSettings.users.push(id) },
);
let careersTables = newTables();
let careers = new MemoryCareersStore(careersTables);

careersStoreContract(
    async () => {
        careersTables = newTables();
        careers = new MemoryCareersStore(careersTables);
        return { ...memoryStores(careersTables), careers };
    },
    {
        pageFields: async () => careers.rows.map((row) => ({ pageSource: row.pageSource ?? null, fallback: row.fallback ?? null, board: row.board ?? null })),
        plantRetryOnce: async (entry) => void careers.rows.push({ ...entry, retryOnce: true }),
        careersRejected: async (key) => JSON.parse(String(careersTables.companies.find((row) => row.company_key === key)?.careers_rejected ?? "[]")) as string[],
    },
);

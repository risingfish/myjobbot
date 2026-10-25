import { alertJobContract } from "./helpers/alertJobContract.js";
import { appliedContract } from "./helpers/appliedContract.js";
import { careersStoreContract } from "./helpers/careersStoreContract.js";
import { companyContract } from "./helpers/companyContract.js";
import { memoryCompanyHooks } from "./helpers/memoryCompanies.js";
import { newTables } from "./helpers/memoryJobViews.js";
import { alertStoreContract } from "./helpers/alertStoreContract.js";
import { descriptionContract } from "./helpers/descriptionContract.js";
import { gmailStoreContract } from "./helpers/gmailStoreContract.js";
import { jobDetailContract } from "./helpers/jobDetailContract.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { MemorySearchSettingsStore } from "./helpers/memorySearchSettingsStore.js";
import { searchSettingsContract } from "./helpers/searchSettingsContract.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());
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
let searchSettings = new MemorySearchSettingsStore();
searchSettingsContract(
    async () => {
        searchSettings = new MemorySearchSettingsStore();
        return { ...memoryStores(), searchSettings };
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

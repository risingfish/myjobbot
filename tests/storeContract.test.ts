import { accountContract } from "./helpers/accountContract.js";
import { authenticatorContract } from "./helpers/authenticatorContract.js";
import { userDataContract } from "./helpers/userDataContract.js";
import { userJobContract } from "./helpers/userJobContract.js";
import { keyContract } from "./helpers/keyContract.js";
import { methodContract } from "./helpers/methodContract.js";
import { sessionContract } from "./helpers/sessionContract.js";
import { attemptContract } from "./helpers/attemptContract.js";
import { accountCodeContract } from "./helpers/accountCodeContract.js";
import { emailLinkContract } from "./helpers/emailLinkContract.js";
import { recoveryCodeContract } from "./helpers/recoveryCodeContract.js";
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
import { memoryStores, type TestStores } from "./helpers/memoryStore.js";
import { memoryUser, type MemoryUser } from "./helpers/memoryAuthTables.js";
import { resumeContract } from "./helpers/resumeContract.js";
import { rescoreContract } from "./helpers/rescoreContract.js";
import { recentContract } from "./helpers/recentContract.js";
import { rescoreLogContract } from "./helpers/rescoreLogContract.js";
import { searchSettingsContract } from "./helpers/searchSettingsContract.js";
import { sourceContract } from "./helpers/sourceContract.js";
import { storeContract } from "./helpers/storeContract.js";

let users: MemoryUser[] = [];

async function withUsers(): Promise<TestStores> {
    const stores = memoryStores();
    users = stores.memory?.auth.users ?? [];
    return stores;
}

async function seedUsers(ids: number[]): Promise<void> {
    for (const id of ids) users.push(memoryUser(id));
}

storeContract(async () => memoryStores());
sessionContract(async () => memoryStores());
attemptContract(async () => memoryStores());
accountContract(async () => memoryStores());
methodContract(async () => memoryStores());
authenticatorContract(async () => memoryStores());
userJobContract(withUsers, { seedUsers });
userDataContract(withUsers, { seedUsers });
accountCodeContract(async () => memoryStores());
emailLinkContract(async () => memoryStores());
recoveryCodeContract(async () => memoryStores());
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
searchSettingsContract(withUsers, { owners: async () => users.map((user) => user.id), seedUser: async (id) => void users.push(memoryUser(id)) });
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

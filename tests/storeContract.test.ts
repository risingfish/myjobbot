import { alertJobContract } from "./helpers/alertJobContract.js";
import { appliedContract } from "./helpers/appliedContract.js";
import { careersStoreContract } from "./helpers/careersStoreContract.js";
import { alertStoreContract } from "./helpers/alertStoreContract.js";
import { descriptionContract } from "./helpers/descriptionContract.js";
import { gmailStoreContract } from "./helpers/gmailStoreContract.js";
import { jobDetailContract } from "./helpers/jobDetailContract.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());
gmailStoreContract(async () => memoryStores());
alertStoreContract(async () => memoryStores());
alertJobContract(async () => memoryStores());
descriptionContract(async () => memoryStores());
jobDetailContract(async () => memoryStores());
appliedContract(async () => memoryStores());
let careers = new MemoryCareersStore();

careersStoreContract(
    async () => {
        careers = new MemoryCareersStore();
        return { ...memoryStores(), careers };
    },
    {
        pageFields: async () => careers.rows.map((row) => ({ pageSource: row.pageSource ?? null, fallback: row.fallback ?? null, board: row.board ?? null })),
        plantRetryOnce: async (entry) => void careers.rows.push({ ...entry, retryOnce: true }),
    },
);

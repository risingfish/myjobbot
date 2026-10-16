import { alertJobContract } from "./helpers/alertJobContract.js";
import { alertStoreContract } from "./helpers/alertStoreContract.js";
import { gmailStoreContract } from "./helpers/gmailStoreContract.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());
gmailStoreContract(async () => memoryStores());
alertStoreContract(async () => memoryStores());
alertJobContract(async () => memoryStores());

import { gmailStoreContract } from "./helpers/gmailStoreContract.js";
import { memoryStores } from "./helpers/memoryStore.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());
gmailStoreContract(async () => memoryStores());

import { memoryStores } from "./helpers/memoryStore.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => memoryStores());

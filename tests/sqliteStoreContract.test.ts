import { openSqliteStores } from "../src/db/sqliteStores.js";
import { storeContract } from "./helpers/storeContract.js";

storeContract(async () => openSqliteStores(":memory:"));

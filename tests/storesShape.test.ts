import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { expect, test } from "vitest";
import { storesOver } from "../src/db/kysely/stores.js";
import type { Database } from "../src/db/schema.js";
import { memoryStores } from "./helpers/memoryStore.js";

const unconnected = () => new Kysely<Database>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new DummyDriver(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } });

const operations = (container: object, allowed: string[]) => Object.entries(container).flatMap(([name, member]) => (typeof member === "function" && !allowed.includes(name) ? [name] : []));

test("the store containers hold stores, not operations: only forUser and close are functions", () => {
    const kysely = storesOver(unconnected());
    const memory = memoryStores();
    expect([operations(kysely, ["forUser", "close"]), operations(kysely.forUser(2), []), operations(memory, ["forUser", "close"]), operations(memory.forUser(2), [])]).toEqual([[], [], [], []]);
});

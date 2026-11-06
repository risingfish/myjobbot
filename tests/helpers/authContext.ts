import { randomBytes } from "node:crypto";
import type { AuthContext } from "../../src/accounts/flows/context.js";
import { MemoryAccountStore } from "./memoryAccountStore.js";
import { newAuthTables } from "./memoryAuthTables.js";
import { MemoryMethodStore } from "./memoryMethodStore.js";
import { MemorySessionStore } from "./memorySessionStore.js";

export function authContext(start = "2026-11-06T10:00:00.000Z") {
    const tables = newAuthTables();
    let at = Date.parse(start);
    const ctx: AuthContext = { stores: { sessions: new MemorySessionStore(tables), accounts: new MemoryAccountStore(tables), methods: new MemoryMethodStore(tables) }, now: () => new Date(at).toISOString(), random: randomBytes };
    const clock = { advance: (ms: number) => void (at += ms) };
    return { ctx, clock, auth: { tables, events: tables.events } };
}

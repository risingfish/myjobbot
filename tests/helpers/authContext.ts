import { randomBytes } from "node:crypto";
import type { AuthContext } from "../../src/accounts/flows/context.js";
import { MemoryAccountStore } from "./memoryAccountStore.js";
import { MemoryMailer } from "./memoryMailer.js";
import { newAuthTables } from "./memoryAuthTables.js";
import { MemoryMethodStore } from "./memoryMethodStore.js";
import { MemorySessionStore } from "./memorySessionStore.js";
import { MemoryTokenStore } from "./memoryTokenStore.js";

export function authContext(start = "2026-11-06T10:00:00.000Z") {
    const tables = newAuthTables();
    let at = Date.parse(start);
    const mailer = new MemoryMailer();
    const ctx: AuthContext = { mail: { mailer, baseUrl: "http://localhost:8080" }, stores: { sessions: new MemorySessionStore(tables), accounts: new MemoryAccountStore(tables), methods: new MemoryMethodStore(tables), tokens: new MemoryTokenStore(tables) }, now: () => new Date(at).toISOString(), random: randomBytes };
    const clock = { advance: (ms: number) => void (at += ms) };
    return { ctx, clock, mailer, auth: { tables, events: tables.events } };
}

import { randomBytes } from "node:crypto";
import type { AuthContext } from "../../src/accounts/flows/context.js";
import { MemoryAccountStore } from "./memoryAccountStore.js";
import { MemoryAttemptStore } from "./memoryAttemptStore.js";
import { MemoryAuthenticatorStore } from "./memoryAuthenticatorStore.js";
import { MemoryMailer } from "./memoryMailer.js";
import { newAuthTables } from "./memoryAuthTables.js";
import { MemoryKeyStore } from "./memoryKeyStore.js";
import { MemoryMethodStore } from "./memoryMethodStore.js";
import { MemorySecurityEventLog } from "./memorySecurityEventLog.js";
import { MemorySessionStore } from "./memorySessionStore.js";
import { MemoryAccountCodeStore } from "./memoryAccountCodeStore.js";
import { MemoryEmailLinkStore } from "./memoryEmailLinkStore.js";
import { MemoryRecoveryCodeStore } from "./memoryRecoveryCodeStore.js";

export function authContext(start = "2026-11-06T10:00:00.000Z") {
    const tables = newAuthTables();
    let at = Date.parse(start);
    const mailer = new MemoryMailer();
    const ctx: AuthContext = { mail: { mailer, baseUrl: "http://localhost:8080" }, secretKey: randomBytes(32), relyingParty: { id: "localhost", origin: "http://localhost:8080" }, stores: { sessions: new MemorySessionStore(tables), attempts: new MemoryAttemptStore(tables), accounts: new MemoryAccountStore(tables), events: new MemorySecurityEventLog(tables), methods: new MemoryMethodStore(tables), authenticators: new MemoryAuthenticatorStore(tables), accountCodes: new MemoryAccountCodeStore(tables), emailLinks: new MemoryEmailLinkStore(tables), recoveryCodes: new MemoryRecoveryCodeStore(tables), keys: new MemoryKeyStore(tables) }, now: () => new Date(at).toISOString(), random: randomBytes };
    const clock = { advance: (ms: number) => void (at += ms) };
    return { ctx, clock, mailer, auth: { tables, events: tables.events } };
}

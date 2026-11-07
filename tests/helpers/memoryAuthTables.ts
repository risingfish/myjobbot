import type { SecurityEvent } from "../../src/db/accountStore.js";
import type { AttemptKey, Session } from "../../src/db/sessionStore.js";
import { allMethods, keepsAWay } from "../../src/accounts/methods.js";
import type { MethodChange, MethodKind, MethodRow } from "../../src/db/methodStore.js";

export interface MemoryUser {
    id: number;
    name: string;
    createdAt: string;
    email: string | null;
    emailKey: string | null;
    isAdmin: boolean;
}

export interface MemoryMethod {
    userId: number;
    kind: string;
    enabled: boolean;
    ready: boolean;
    passwordDigest: string | null;
    updatedAt: string;
    totpSecret?: string | null;
    totpLastStep?: number | null;
}

export interface MemoryCode {
    digest: string;
    createdBy: number;
    expiresAt: string;
    usedBy: number | null;
}

export interface MemoryEmailToken {
    digest: string;
    userId: number;
    purpose: string;
    newEmail: string | null;
    sessionDigest: string | null;
    returnPath: string | null;
    expiresAt: string;
    usedAt: string | null;
}

export interface AuthTables {
    users: MemoryUser[];
    methods: MemoryMethod[];
    sessions: Session[];
    attempts: Array<AttemptKey & { at: string }>;
    events: SecurityEvent[];
    codes: MemoryCode[];
    emailTokens: MemoryEmailToken[];
    recoveryCodes: Array<{ userId: number; digest: string; usedAt: string | null }>;
}

export function newAuthTables(): AuthTables {
    return { users: [], methods: [], sessions: [], attempts: [], events: [], codes: [], emailTokens: [], recoveryCodes: [] };
}

export function upsertMethod(tables: AuthTables, method: MemoryMethod): void {
    const index = tables.methods.findIndex((row) => row.userId === method.userId && row.kind === method.kind);
    if (index === -1) tables.methods.push(method);
    else tables.methods[index] = { ...tables.methods[index], ...method };
}

export function storedWays(tables: AuthTables, userId: number): MethodRow[] {
    return tables.methods.filter((method) => method.userId === userId).map((method) => ({ kind: method.kind as MethodKind, enabled: method.enabled, ready: method.ready }));
}

export function changeKeepingAWay(tables: AuthTables, userId: number, step: { change: MethodChange | (() => MethodChange | null); apply: (rows: MethodRow[]) => void }): "ok" | "last_way" {
    const rows = allMethods(storedWays(tables, userId));
    const change = typeof step.change === "function" ? step.change() : step.change;
    if (change !== null && !keepsAWay(rows, change)) return "last_way";
    step.apply(rows);
    return "ok";
}

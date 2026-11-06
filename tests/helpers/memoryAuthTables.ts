import type { SecurityEvent } from "../../src/db/accountStore.js";
import type { AttemptKey, Session } from "../../src/db/sessionStore.js";

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
}

export interface AuthTables {
    users: MemoryUser[];
    methods: MemoryMethod[];
    sessions: Session[];
    attempts: Array<AttemptKey & { at: string }>;
    events: SecurityEvent[];
}

export function newAuthTables(): AuthTables {
    return { users: [], methods: [], sessions: [], attempts: [], events: [] };
}

export function upsertMethod(tables: AuthTables, method: MemoryMethod): void {
    const index = tables.methods.findIndex((row) => row.userId === method.userId && row.kind === method.kind);
    if (index === -1) tables.methods.push(method);
    else tables.methods[index] = { ...tables.methods[index], ...method };
}

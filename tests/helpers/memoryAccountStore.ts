import type { Account, AccountStore, CreateResult, NewAccount, OwnerLogin, SecurityEvent } from "../../src/db/accountStore.js";
import { OWNER_ID } from "../../src/db/owner.js";
import { upsertMethod, type AuthTables, type MemoryUser } from "./memoryAuthTables.js";

function toAccount(user: MemoryUser): Account {
    return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin };
}

export class MemoryAccountStore implements AccountStore {
    constructor(private readonly tables: AuthTables) {}

    get events(): SecurityEvent[] {
        return this.tables.events;
    }

    async initOwner(owner: OwnerLogin, now: string): Promise<boolean> {
        let user = this.tables.users.find((row) => row.id === OWNER_ID);
        if (user === undefined) {
            user = { id: OWNER_ID, name: "owner", createdAt: now, email: null, emailKey: null, isAdmin: false };
            this.tables.users.push(user);
        }
        if (user.email !== null) return false;
        if (this.tables.users.some((row) => row.emailKey === owner.emailKey)) throw new Error("duplicate email_key");
        Object.assign(user, { email: owner.email, emailKey: owner.emailKey, isAdmin: true });
        upsertMethod(this.tables, { userId: OWNER_ID, kind: "password", enabled: true, ready: true, passwordDigest: owner.passwordDigest, updatedAt: now });
        return true;
    }

    async byEmailKey(emailKey: string): Promise<Account | null> {
        const user = this.tables.users.find((row) => row.emailKey === emailKey);
        return user === undefined ? null : toAccount(user);
    }

    async account(id: number): Promise<Account | null> {
        const user = this.tables.users.find((row) => row.id === id);
        return user === undefined ? null : toAccount(user);
    }

    async createAccount(account: NewAccount, codeDigest: string, now: string): Promise<CreateResult> {
        if (this.tables.users.some((user) => user.emailKey === account.emailKey)) return { kind: "taken" };
        const code = this.tables.codes.find((row) => row.digest === codeDigest && row.usedBy === null && row.expiresAt > now);
        if (code === undefined) return { kind: "refused" };
        const id = Math.max(0, ...this.tables.users.map((user) => user.id)) + 1;
        this.tables.users.push({ id, name: account.name, createdAt: now, email: account.email, emailKey: account.emailKey, isAdmin: false });
        upsertMethod(this.tables, { userId: id, kind: "password", enabled: true, ready: true, passwordDigest: account.passwordDigest, updatedAt: now });
        code.usedBy = id;
        return { kind: "created", userId: id };
    }

    async accounts(): Promise<Account[]> {
        return this.tables.users.filter((user) => user.email !== null).map(toAccount);
    }

    async userIds(): Promise<number[]> {
        return this.tables.users.map((user) => user.id).sort((a, b) => a - b);
    }

    async setAdmin(userId: number, admin: boolean): Promise<"ok" | "last_admin"> {
        const admins = this.tables.users.filter((user) => user.isAdmin);
        if (!admin && admins.length === 1 && admins[0]?.id === userId) return "last_admin";
        for (const user of this.tables.users) if (user.id === userId) user.isAdmin = admin;
        return "ok";
    }

    async saveName(userId: number, name: string): Promise<void> {
        for (const user of this.tables.users) if (user.id === userId) user.name = name;
    }

    async recentEvents(userId: number, limit: number): Promise<SecurityEvent[]> {
        return this.tables.events
            .filter((event) => event.userId === userId)
            .map((event, index) => ({ event, index }))
            .sort((a, b) => b.event.at.localeCompare(a.event.at) || b.index - a.index)
            .slice(0, limit)
            .map(({ event }) => ({ ...event }));
    }

    async changeEmail(userId: number, email: string, emailKey: string): Promise<"ok" | "taken"> {
        if (this.tables.users.some((user) => user.emailKey === emailKey && user.id !== userId)) return "taken";
        for (const user of this.tables.users) if (user.id === userId) Object.assign(user, { email, emailKey });
        return "ok";
    }

    async recordEvent(event: SecurityEvent): Promise<void> {
        this.tables.events.push({ ...event });
    }
}

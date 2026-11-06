import type { Account, AccountStore, OwnerLogin, SecurityEvent } from "../../src/db/accountStore.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
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

    async isAdmin(id: number): Promise<boolean> {
        return (await this.account(id))?.isAdmin ?? false;
    }

    async recordEvent(event: SecurityEvent): Promise<void> {
        this.tables.events.push({ ...event });
    }
}

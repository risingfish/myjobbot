import { afterChange, allMethods, keepsAWay } from "../../src/accounts/methods.js";
import type { AuthenticatorRow, MethodChange, MethodKind, MethodRow, MethodStore } from "../../src/db/methodStore.js";
import { upsertMethod, type AuthTables } from "./memoryAuthTables.js";

export class MemoryMethodStore implements MethodStore {
    constructor(private readonly tables: AuthTables) {}

    async passwordDigest(userId: number): Promise<string | null> {
        const row = this.tables.methods.find((method) => method.userId === userId && method.kind === "password" && method.enabled && method.ready);
        return row?.passwordDigest ?? null;
    }

    async methods(userId: number): Promise<MethodRow[]> {
        return allMethods(this.stored(userId));
    }

    async setEnabled(userId: number, change: MethodChange, now: string): Promise<"ok" | "last_way"> {
        const rows = allMethods(this.stored(userId));
        if (!keepsAWay(rows, change)) return "last_way";
        const row = afterChange(rows, change).find((method) => method.kind === change.kind);
        const existing = this.tables.methods.find((method) => method.userId === userId && method.kind === change.kind);
        upsertMethod(this.tables, { userId, kind: change.kind, enabled: change.enabled, ready: row?.ready ?? false, passwordDigest: existing?.passwordDigest ?? null, updatedAt: now });
        return "ok";
    }

    async authenticator(userId: number): Promise<AuthenticatorRow> {
        const row = this.app(userId);
        return { sealedSecret: row?.totpSecret ?? null, enabled: row?.enabled ?? false, ready: row?.ready ?? false };
    }

    async saveAuthenticator(userId: number, app: { sealedSecret: string; ready: boolean }, now: string): Promise<void> {
        const lastStep = this.app(userId)?.totpLastStep ?? null;
        upsertMethod(this.tables, { userId, kind: "authenticator", enabled: true, ready: app.ready, passwordDigest: null, updatedAt: now, totpSecret: app.sealedSecret, totpLastStep: lastStep });
    }

    async removeAuthenticator(userId: number, options: { mailOn: boolean }, now: string): Promise<"ok" | "last_way"> {
        if (!keepsAWay(allMethods(this.stored(userId)), { kind: "authenticator", enabled: false, mailOn: options.mailOn })) return "last_way";
        upsertMethod(this.tables, { userId, kind: "authenticator", enabled: false, ready: false, passwordDigest: null, updatedAt: now, totpSecret: null, totpLastStep: null });
        return "ok";
    }

    async acceptStep(userId: number, step: number): Promise<boolean> {
        const row = this.app(userId);
        if (row === undefined || (row.totpLastStep ?? Number.NEGATIVE_INFINITY) >= step) return false;
        row.totpLastStep = step;
        return true;
    }

    private app(userId: number) {
        return this.tables.methods.find((method) => method.userId === userId && method.kind === "authenticator");
    }

    private stored(userId: number): MethodRow[] {
        return this.tables.methods.filter((method) => method.userId === userId).map((method) => ({ kind: method.kind as MethodKind, enabled: method.enabled, ready: method.ready }));
    }

    async setPassword(userId: number, digest: string, now: string): Promise<void> {
        upsertMethod(this.tables, { userId, kind: "password", enabled: true, ready: true, passwordDigest: digest, updatedAt: now });
    }
}

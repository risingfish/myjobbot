import type { AuthenticatorRow, AuthenticatorStore } from "../../src/db/authenticatorStore.js";
import { changeKeepingAWay, upsertMethod, type AuthTables } from "./memoryAuthTables.js";

export class MemoryAuthenticatorStore implements AuthenticatorStore {
    constructor(private readonly tables: AuthTables) {}

    async authenticator(userId: number): Promise<AuthenticatorRow> {
        const row = this.app(userId);
        return { sealedSecret: row?.totpSecret ?? null, enabled: row?.enabled ?? false, ready: row?.ready ?? false };
    }

    async saveAuthenticator(userId: number, app: { sealedSecret: string; ready: boolean }, now: string): Promise<void> {
        const lastStep = this.app(userId)?.totpLastStep ?? null;
        upsertMethod(this.tables, { userId, kind: "authenticator", enabled: true, ready: app.ready, passwordDigest: null, updatedAt: now, totpSecret: app.sealedSecret, totpLastStep: lastStep });
    }

    async removeAuthenticator(userId: number, options: { mailOn: boolean }, now: string): Promise<"ok" | "last_way"> {
        return changeKeepingAWay(this.tables, userId, {
            change: { kind: "authenticator", enabled: false, mailOn: options.mailOn },
            apply: () => upsertMethod(this.tables, { userId, kind: "authenticator", enabled: false, ready: false, passwordDigest: null, updatedAt: now, totpSecret: null, totpLastStep: null }),
        });
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
}

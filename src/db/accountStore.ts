export interface Account {
    id: number;
    name: string;
    email: string | null;
    isAdmin: boolean;
    deactivatedAt: string | null;
    deleteAfter: string | null;
}

export type AccountStatus = Pick<Account, "deactivatedAt" | "deleteAfter">;

export interface OwnerLogin {
    email: string;
    emailKey: string;
    passwordDigest: string;
}

export interface NewAccount {
    email: string;
    emailKey: string;
    name: string;
    passwordDigest: string;
}

export type CreateResult = { kind: "created"; userId: number } | { kind: "refused" } | { kind: "taken" };

export interface AccountStore {
    initOwner(owner: OwnerLogin, now: string): Promise<boolean>;
    byEmailKey(emailKey: string): Promise<Account | null>;
    account(id: number): Promise<Account | null>;
    createAccount(account: NewAccount, codeDigest: string, now: string): Promise<CreateResult>;
    accounts(): Promise<Account[]>;
    userIds(): Promise<number[]>;
    setAdmin(userId: number, admin: boolean): Promise<"ok" | "last_admin">;
    saveName(userId: number, name: string): Promise<void>;
    changeEmail(userId: number, email: string, emailKey: string): Promise<"ok" | "taken">;
    setStatus(userId: number, change: Partial<AccountStatus>): Promise<void>;
    reactivate(userId: number): Promise<"ok" | "deletion_pending">;
}

import type { SecurityEventName } from "../accounts/events.js";

export interface Account {
    id: number;
    name: string;
    email: string | null;
    isAdmin: boolean;
}

export interface OwnerLogin {
    email: string;
    emailKey: string;
    passwordDigest: string;
}

export interface SecurityEvent {
    userId: number;
    at: string;
    address: string | null;
    event: SecurityEventName;
    method: string | null;
}

export interface AccountStore {
    initOwner(owner: OwnerLogin, now: string): Promise<boolean>;
    byEmailKey(emailKey: string): Promise<Account | null>;
    account(id: number): Promise<Account | null>;
    isAdmin(id: number): Promise<boolean>;
    recordEvent(event: SecurityEvent): Promise<void>;
}

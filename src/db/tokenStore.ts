export const CODE_DAYS = 7;

export type LinkPurpose = "signin" | "reset" | "email_change" | "step_up";

const LIFETIME_MINUTES: Record<LinkPurpose, number> = { signin: 15, step_up: 15, reset: 30, email_change: 24 * 60 };

export interface NewEmailToken {
    purpose: LinkPurpose;
    digest: string;
    newEmail?: string;
    sessionDigest?: string;
    returnPath?: string;
}

export interface SpentToken {
    userId: number;
    newEmail: string | null;
    returnPath: string | null;
}

export interface TokenSpend {
    digest: string;
    purpose: LinkPurpose;
    sessionDigest?: string;
}

export interface TokenLookup {
    purpose: string;
    sessionDigest: string | null;
    live: boolean;
}

export interface TokenStore {
    makeCode(digest: string, createdBy: number, now: string): Promise<void>;
    makeEmailToken(userId: number, token: NewEmailToken, now: string): Promise<void>;
    spendEmailToken(spend: TokenSpend, now: string): Promise<SpentToken | null>;
    emailTokenFor(digest: string, now: string): Promise<TokenLookup | null>;
    replaceRecoveryCodes(userId: number, digests: string[], now: string): Promise<void>;
    spendRecoveryCode(userId: number, digest: string, now: string): Promise<boolean>;
    recoveryCodesLeft(userId: number): Promise<number>;
}

/** Returns the time a number of days after another, as an ISO string. */
export function daysAfter(now: string, days: number): string {
    return new Date(Date.parse(now) + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Returns when an emailed link of a purpose made now stops working. */
export function linkExpiry(purpose: LinkPurpose, now: string): string {
    return new Date(Date.parse(now) + LIFETIME_MINUTES[purpose] * 60 * 1000).toISOString();
}

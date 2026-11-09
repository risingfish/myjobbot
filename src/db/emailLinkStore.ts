export type LinkPurpose = "signin" | "reset" | "email_change" | "step_up";

const LIFETIME_MINUTES: Record<LinkPurpose, number> = { signin: 15, step_up: 15, reset: 30, email_change: 24 * 60 };

const SESSION_BOUND: Record<LinkPurpose, boolean> = { signin: false, reset: false, email_change: false, step_up: true };

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

export interface EmailLinkStore {
    make(userId: number, token: NewEmailToken, now: string): Promise<void>;
    spend(spend: TokenSpend, now: string): Promise<SpentToken | null>;
    lookup(digest: string, now: string): Promise<TokenLookup | null>;
}

/** Returns when an emailed link of a purpose made now stops working. */
export function linkExpiry(purpose: LinkPurpose, now: string): string {
    return new Date(Date.parse(now) + LIFETIME_MINUTES[purpose] * 60 * 1000).toISOString();
}

/** Says whether a link of a purpose works only from the sign-in that asked for it. */
export function boundToSession(purpose: LinkPurpose): boolean {
    return SESSION_BOUND[purpose];
}

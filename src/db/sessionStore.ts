export const SESSION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Session {
    idDigest: string;
    userId: number;
    csrfDigest: string;
    createdAt: string;
    lastUsedAt: string;
    verifiedAt: string;
    endedAt: string | null;
    address: string;
    device: Device;
}

export interface Device {
    ip: string | null;
    os: string | null;
    location: string | null;
}

export type NewSession = Omit<Session, "endedAt">;

export type AttemptKind = "signin_fail" | "mail_request" | "code_attempt";

export interface AttemptKey {
    kind: AttemptKind;
    scope: "email" | "address";
    keyDigest: string;
}

export interface SessionStore {
    create(session: NewSession): Promise<void>;
    find(idDigest: string, now: string): Promise<Session | null>;
    touch(idDigest: string, now: string): Promise<void>;
    end(idDigest: string, now: string): Promise<void>;
    endAllFor(userId: number, now: string, exceptDigest?: string): Promise<void>;
    rebindCsrf(idDigest: string, csrfDigest: string): Promise<void>;
    pruneEnded(now: string): Promise<void>;
    recordAttempt(key: AttemptKey, at: string): Promise<void>;
    countAttempts(key: AttemptKey, since: string): Promise<number>;
    setVerified(idDigest: string, now: string): Promise<void>;
    activeFor(userId: number, now: string): Promise<Session[]>;
}

/** Returns the time a number of days before another, as an ISO string. */
export function daysBefore(now: string, days: number): string {
    return new Date(Date.parse(now) - days * DAY_MS).toISOString();
}

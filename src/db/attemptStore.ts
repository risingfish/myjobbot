export type AttemptKind = "signin_fail" | "mail_request" | "code_attempt";

export interface AttemptKey {
    kind: AttemptKind;
    scope: "email" | "address";
    keyDigest: string;
}

export interface AttemptStore {
    recordAttempt(key: AttemptKey, at: string): Promise<void>;
    countAttempts(key: AttemptKey, since: string): Promise<number>;
}

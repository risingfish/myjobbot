export const METHOD_KINDS = ["password", "email_link", "hardware_key", "authenticator"] as const;

export type MethodKind = (typeof METHOD_KINDS)[number];

export interface MethodRow {
    kind: MethodKind;
    enabled: boolean;
    ready: boolean;
}

export interface MethodChange {
    kind: MethodKind;
    enabled: boolean;
    mailOn: boolean;
}

export interface AuthenticatorRow {
    sealedSecret: string | null;
    enabled: boolean;
    ready: boolean;
}

export interface MethodStore {
    passwordDigest(userId: number): Promise<string | null>;
    setPassword(userId: number, digest: string, now: string): Promise<void>;
    methods(userId: number): Promise<MethodRow[]>;
    setEnabled(userId: number, change: MethodChange, now: string): Promise<"ok" | "last_way">;
    authenticator(userId: number): Promise<AuthenticatorRow>;
    saveAuthenticator(userId: number, app: { sealedSecret: string; ready: boolean }, now: string): Promise<void>;
    removeAuthenticator(userId: number, options: { mailOn: boolean }, now: string): Promise<"ok" | "last_way">;
    acceptStep(userId: number, step: number): Promise<boolean>;
}

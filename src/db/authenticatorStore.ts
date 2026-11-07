export interface AuthenticatorRow {
    sealedSecret: string | null;
    enabled: boolean;
    ready: boolean;
}

export interface AuthenticatorStore {
    authenticator(userId: number): Promise<AuthenticatorRow>;
    saveAuthenticator(userId: number, app: { sealedSecret: string; ready: boolean }, now: string): Promise<void>;
    removeAuthenticator(userId: number, options: { mailOn: boolean }, now: string): Promise<"ok" | "last_way">;
    acceptStep(userId: number, step: number): Promise<boolean>;
}

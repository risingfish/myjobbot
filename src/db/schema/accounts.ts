import type { ColumnType, Generated } from "kysely";

type Optional<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface SignInMethodsTable {
    user_id: number;
    kind: string;
    enabled: number;
    ready: number;
    password_digest: Optional<string>;
    totp_secret: Optional<string>;
    totp_last_step: Optional<number>;
    updated_at: string;
}

export interface HardwareKeysTable {
    id: Generated<number>;
    user_id: number;
    name: string;
    credential_id: string;
    public_key: string;
    counter: number;
    transports: Optional<string>;
    created_at: string;
    last_used_at: Optional<string>;
}

export interface RecoveryCodesTable {
    id: Generated<number>;
    user_id: number;
    digest: string;
    created_at: string;
    used_at: Optional<string>;
}

export interface SessionsTable {
    id_digest: string;
    user_id: number;
    csrf_digest: string;
    created_at: string;
    last_used_at: string;
    verified_at: string;
    ended_at: Optional<string>;
    address: string;
}

export interface AccountCodesTable {
    digest: string;
    created_by: number;
    created_at: string;
    expires_at: string;
    used_by: Optional<number>;
    used_at: Optional<string>;
}

export interface EmailTokensTable {
    digest: string;
    user_id: number;
    purpose: string;
    new_email: Optional<string>;
    session_digest: Optional<string>;
    return_path: Optional<string>;
    created_at: string;
    expires_at: string;
    used_at: Optional<string>;
}

export interface AuthChallengesTable {
    digest: string;
    purpose: string;
    user_id: Optional<number>;
    expires_at: string;
    used_at: Optional<string>;
}

export interface AuthAttemptsTable {
    id: Generated<number>;
    kind: string;
    scope: string;
    key_digest: string;
    at: string;
}

export interface SecurityEventsTable {
    id: Generated<number>;
    user_id: number;
    at: string;
    address: Optional<string>;
    event: string;
    method: Optional<string>;
}

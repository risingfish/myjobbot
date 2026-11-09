export type GmailStatus = "none" | "connected" | "needs_reconnect";

export interface GmailConnectionRow {
    email: string | null;
    app_password: string | null;
    connected_at: string | null;
    status: GmailStatus;
    reason: string | null;
}

export interface GmailLogin {
    email: string;
    sealedPassword: string;
}

export interface GmailStore {
    connection(): Promise<GmailConnectionRow | null>;
    connected(login: GmailLogin, at: string): Promise<void>;
    needsReconnect(reason: string): Promise<void>;
    disconnect(): Promise<void>;
}

export interface AlertStateRow {
    uid_validity: number | null;
    last_uid: number | null;
    last_run_at: string | null;
    emails_read: number;
    jobs_found: number;
    not_understood: number;
}

export interface AlertRead {
    uidValidity: number;
    lastUid: number | null;
    emails: number;
    jobs: number;
    notUnderstood: number;
}

export interface AlertStore {
    state(): Promise<AlertStateRow | null>;
    recordRead(read: AlertRead, at: string): Promise<void>;
    clear(): Promise<void>;
}

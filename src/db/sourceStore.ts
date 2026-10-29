export const SOURCE_OUTCOMES = ["ok", "partial", "failing"] as const;

export interface SourceOutcome {
    at: string;
    outcome: (typeof SOURCE_OUTCOMES)[number];
    jobs: number;
    cost: number;
    reason: string | null;
}

export interface NewSource {
    module: string;
    name: string;
    params: unknown;
    target: string;
    enabled: boolean;
}

export type AccountSource = Pick<NewSource, "module" | "name">;

export interface SavedSource extends NewSource {
    id: number;
    companyId: number | null;
    cursor: unknown;
    last: SourceOutcome | null;
}

export interface SourceKey {
    userId: number;
    id: number;
}

export interface SourceStore {
    list(userId: number): Promise<SavedSource[]>;
    save(userId: number, source: NewSource | SavedSource, at: string): Promise<SavedSource>;
    setEnabled(key: SourceKey, enabled: boolean, at: string): Promise<void>;
    remove(key: SourceKey): Promise<void>;
    recordFetch(key: SourceKey, outcome: SourceOutcome, cursor: unknown): Promise<void>;
    linkCompany(key: SourceKey, companyId: number): Promise<void>;
    ensureAccountSource(userId: number, source: AccountSource, at: string): Promise<void>;
}

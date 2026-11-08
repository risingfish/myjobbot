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

export interface UserSourceStore {
    list(): Promise<SavedSource[]>;
    save(source: NewSource | SavedSource, at: string): Promise<SavedSource>;
    setEnabled(id: number, enabled: boolean, at: string): Promise<void>;
    remove(id: number): Promise<void>;
    recordFetch(id: number, outcome: SourceOutcome, cursor: unknown): Promise<void>;
    linkCompany(id: number, companyId: number): Promise<void>;
    ensureAccountSource(source: AccountSource, at: string): Promise<void>;
}

/** Gives one user's view of the saved sources, every call made for that user. */
export function userSourceStore(store: SourceStore, userId: number): UserSourceStore {
    return {
        list: () => store.list(userId),
        save: (source, at) => store.save(userId, source, at),
        setEnabled: (id, enabled, at) => store.setEnabled({ userId, id }, enabled, at),
        remove: (id) => store.remove({ userId, id }),
        recordFetch: (id, outcome, cursor) => store.recordFetch({ userId, id }, outcome, cursor),
        linkCompany: (id, companyId) => store.linkCompany({ userId, id }, companyId),
        ensureAccountSource: (source, at) => store.ensureAccountSource(userId, source, at),
    };
}

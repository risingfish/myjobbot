import { z } from "zod";

export const OWNER_ID = 1;

export const rawSearchSettings = z.record(z.string(), z.unknown());

export type RawSearchSettings = z.infer<typeof rawSearchSettings>;

export interface SearchSettingsStore {
    load(userId: number): Promise<RawSearchSettings | null>;
    save(userId: number, settings: RawSearchSettings, at: string): Promise<void>;
}

export interface UserSearchSettingsStore {
    load(): Promise<RawSearchSettings | null>;
    save(settings: RawSearchSettings, at: string): Promise<void>;
}

/** Gives one user's search settings, every call made for that user. */
export function userSearchSettingsStore(store: SearchSettingsStore, userId: number): UserSearchSettingsStore {
    return { load: () => store.load(userId), save: (settings, at) => store.save(userId, settings, at) };
}

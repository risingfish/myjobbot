import { z } from "zod";

export const OWNER_ID = 1;

export const rawSearchSettings = z.record(z.string(), z.unknown());

export type RawSearchSettings = z.infer<typeof rawSearchSettings>;

export interface SearchSettingsStore {
    load(userId: number): Promise<RawSearchSettings | null>;
    importIfAbsent(settings: RawSearchSettings, at: string): Promise<boolean>;
    save(userId: number, settings: RawSearchSettings, at: string): Promise<void>;
}

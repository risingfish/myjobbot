import { OWNER_ID, rawSearchSettings, type RawSearchSettings, type SearchSettingsStore } from "../../src/db/searchSettingsStore.js";

export class MemorySearchSettingsStore implements SearchSettingsStore {
    readonly users: number[] = [];
    private readonly rows = new Map<number, string>();

    async load(userId: number): Promise<RawSearchSettings | null> {
        const row = this.rows.get(userId);
        return row === undefined ? null : rawSearchSettings.parse(JSON.parse(row));
    }

    async importIfAbsent(settings: RawSearchSettings): Promise<boolean> {
        if (!this.users.includes(OWNER_ID)) this.users.push(OWNER_ID);
        if (this.rows.has(OWNER_ID)) return false;
        this.rows.set(OWNER_ID, JSON.stringify(settings));
        return true;
    }

    put(userId: number, settings: RawSearchSettings): void {
        this.rows.set(userId, JSON.stringify(settings));
    }
}

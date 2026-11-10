import { rawSearchSettings, type RawSearchSettings, type SearchSettingsStore } from "../../src/db/searchSettingsStore.js";
import { ownerOrRefuse, type MemoryUser } from "./memoryAuthTables.js";

export class MemorySearchSettingsStore implements SearchSettingsStore {
    private readonly rows = new Map<number, string>();

    constructor(private readonly users: MemoryUser[] = []) {}

    dropUser(userId: number): void {
        this.rows.delete(userId);
    }

    async load(userId: number): Promise<RawSearchSettings | null> {
        const row = this.rows.get(userId);
        return row === undefined ? null : rawSearchSettings.parse(JSON.parse(row));
    }

    async save(userId: number, settings: RawSearchSettings, at: string): Promise<void> {
        ownerOrRefuse(this.users, userId, at);
        this.rows.set(userId, JSON.stringify(settings));
    }

    put(userId: number, settings: RawSearchSettings): void {
        this.rows.set(userId, JSON.stringify(settings));
    }
}

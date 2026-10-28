import type { AccountSource, NewSource, SavedSource, SourceKey, SourceOutcome, SourceStore } from "../../src/db/sourceStore.js";

interface Row extends SavedSource {
    userId: number;
}

export class MemorySourceStore implements SourceStore {
    private readonly rows: Row[] = [];
    private nextId = 1;

    async list(userId: number): Promise<SavedSource[]> {
        return this.rows.filter((row) => row.userId === userId).map(({ userId: _userId, ...saved }) => structuredClone(saved));
    }

    async save(userId: number, source: NewSource | SavedSource): Promise<SavedSource> {
        const id = "id" in source ? source.id : this.nextId++;
        const taken = this.rows.find((row) => row.userId === userId && row.id !== id && (row.target === source.target || row.name === source.name));
        if (taken !== undefined) throw new Error("duplicate saved source");
        const fields = { module: source.module, name: source.name, params: structuredClone(source.params), target: source.target, enabled: source.enabled, cursor: null };
        const existing = this.rows.find((row) => row.userId === userId && row.id === id);
        if (existing !== undefined) Object.assign(existing, fields);
        else if ("id" in source) throw new Error("no such saved source");
        else this.rows.push({ ...fields, id, userId, companyId: null, last: null });
        return (await this.list(userId)).find((row) => row.id === id) as SavedSource;
    }

    async setEnabled(key: SourceKey, enabled: boolean): Promise<void> {
        this.update(key, { enabled, cursor: null });
    }

    async remove(key: SourceKey): Promise<void> {
        const index = this.rows.findIndex((row) => row.userId === key.userId && row.id === key.id);
        if (index >= 0) this.rows.splice(index, 1);
    }

    async recordFetch(key: SourceKey, outcome: SourceOutcome, cursor: unknown): Promise<void> {
        this.update(key, { last: { ...outcome }, cursor: structuredClone(cursor ?? null) });
    }

    async linkCompany(key: SourceKey, companyId: number): Promise<void> {
        this.update(key, { companyId });
    }

    async ensureAccountSource(userId: number, { module, name }: AccountSource): Promise<void> {
        if (this.rows.some((row) => row.userId === userId && (row.target === module || row.name === name))) return;
        this.rows.push({ id: this.nextId++, userId, module, name, params: {}, target: module, enabled: true, companyId: null, cursor: null, last: null });
    }

    private update(key: SourceKey, change: Partial<SavedSource>): void {
        const row = this.rows.find((each) => each.userId === key.userId && each.id === key.id);
        if (row !== undefined) Object.assign(row, change);
    }
}

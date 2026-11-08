import type { PlannedSource, SourcePlans } from "../../src/db/sourcePlans.js";
import type { MemorySourceStore } from "./memorySourceStore.js";

export class MemorySourcePlans implements SourcePlans {
    constructor(private readonly sources: MemorySourceStore) {}

    async sourcesOnForAll(): Promise<PlannedSource[]> {
        return this.sources.onForAll();
    }
}

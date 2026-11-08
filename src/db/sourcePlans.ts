export interface PlannedSource {
    userId: number;
    module: string;
}

export interface SourcePlans {
    sourcesOnForAll(): Promise<PlannedSource[]>;
}

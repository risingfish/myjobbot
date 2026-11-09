export interface ApiCallLog {
    record(api: string, source: string, calledAt: string): Promise<void>;
    countSince(api: string, since: string): Promise<number>;
    pruneBefore(cutoff: string): Promise<void>;
}

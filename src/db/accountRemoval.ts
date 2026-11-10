export type RemovalOutcome = "deleted" | "last_admin" | "not_due" | "gone";

export interface AccountRemoval {
    due(now: string): Promise<number[]>;
    remove(userId: number, now: string): Promise<RemovalOutcome>;
}

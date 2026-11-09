export interface RecoveryCodeStore {
    replace(userId: number, digests: string[], now: string): Promise<void>;
    spend(userId: number, digest: string, now: string): Promise<boolean>;
    left(userId: number): Promise<number>;
}

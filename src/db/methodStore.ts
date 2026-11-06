
export interface MethodStore {
    passwordDigest(userId: number): Promise<string | null>;
    setPassword(userId: number, digest: string, now: string): Promise<void>;
}

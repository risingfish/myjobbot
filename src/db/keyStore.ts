export interface NewKey {
    name: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string[];
}

export interface StoredKey extends NewKey {
    id: number;
    userId: number;
}

export type ChallengePurpose = "register" | "signin";

export interface KeyStore {
    addKey(userId: number, key: NewKey, now: string): Promise<"ok" | "name_taken" | "credential_taken">;
    keys(userId: number): Promise<Array<{ id: number; name: string }>>;
    keyByCredential(credentialId: string): Promise<StoredKey | null>;
    credentialsOf(userId: number): Promise<Array<{ credentialId: string; transports: string[] }>>;
    updateCounter(id: number, counter: number, now: string): Promise<void>;
    removeKey(userId: number, removal: { id: number; mailOn: boolean }, now: string): Promise<"ok" | "last_way">;
    makeChallenge(digest: string, challenge: { purpose: ChallengePurpose; userId: number | null }, now: string): Promise<void>;
    spendChallenge(digest: string, purpose: ChallengePurpose, now: string): Promise<{ userId: number | null } | null>;
}

/** Returns when a key challenge made now stops working: 5 minutes on. */
export function challengeExpiry(now: string): string {
    return new Date(Date.parse(now) + 5 * 60 * 1000).toISOString();
}

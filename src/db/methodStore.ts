import type { CardKind } from "../accounts/ways/catalog.js";

export type MethodKind = CardKind;

export interface MethodRow {
    kind: MethodKind;
    enabled: boolean;
    ready: boolean;
}

export interface MethodChange {
    kind: MethodKind;
    enabled: boolean;
    mailOn: boolean;
}

export interface MethodStore {
    passwordDigest(userId: number): Promise<string | null>;
    setPassword(userId: number, digest: string, now: string): Promise<void>;
    methods(userId: number): Promise<MethodRow[]>;
    setEnabled(userId: number, change: MethodChange, now: string): Promise<"ok" | "last_way">;
}

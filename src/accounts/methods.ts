import type { MethodChange, MethodKind, MethodRow } from "../db/methodStore.js";
import { CARD_KINDS, wayEntry } from "./ways/catalog.js";

/** Says whether a way of signing in can be used: enabled and set up, and for emailed links only while mail is set up. */
export function usable(row: MethodRow, options: { mailOn: boolean }): boolean {
    return row.enabled && row.ready && (!wayEntry(row.kind).needsMail || options.mailOn);
}

/** Returns an account's four ways in order, a way with no stored row shown as off and not set up. */
export function allMethods(stored: MethodRow[]): MethodRow[] {
    return CARD_KINDS.map((kind: MethodKind) => stored.find((row) => row.kind === kind) ?? { kind, enabled: false, ready: false });
}

/** Returns the rows after a change: the way switched on or off, an emailed link counting as set up once switched on. */
export function afterChange(rows: MethodRow[], change: MethodChange): MethodRow[] {
    return rows.map((row) => (row.kind === change.kind ? { ...row, enabled: change.enabled, ready: row.ready || (change.enabled && wayEntry(change.kind).readyWhenOn) } : row));
}

/** Says whether a change keeps at least one way usable; switching a way on never breaks the rule. */
export function keepsAWay(rows: MethodRow[], change: MethodChange): boolean {
    return change.enabled || afterChange(allMethods(rows), change).some((row) => usable(row, change));
}

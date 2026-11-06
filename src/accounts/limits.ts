import type { AttemptKey, AttemptKind } from "../db/sessionStore.js";
import { tokenDigest } from "./tokens.js";

export interface Limit {
    kind: AttemptKind;
    scope: AttemptKey["scope"];
    max: number;
    minutes: number;
}

const LIMITS = {
    signinEmail: { kind: "signin_fail", scope: "email", max: 5, minutes: 15 },
    signinAddress: { kind: "signin_fail", scope: "address", max: 20, minutes: 15 },
    mailEmail: { kind: "mail_request", scope: "email", max: 3, minutes: 15 },
    codeAddress: { kind: "code_attempt", scope: "address", max: 10, minutes: 60 },
} as const satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

/** Returns one of the attempt limits: what it counts, how many and over how many minutes. */
export function limitFor(name: LimitName): Limit {
    return LIMITS[name];
}

/** Returns the attempt key a limit counts for one email key or client address, holding only its digest. */
export function attemptKey(limit: Limit, value: string): AttemptKey {
    return { kind: limit.kind, scope: limit.scope, keyDigest: tokenDigest(`${limit.scope}:${value}`) };
}

/** Returns the start of a limit's window before a time. */
export function windowStart(limit: Limit, now: string): string {
    return new Date(Date.parse(now) - limit.minutes * 60 * 1000).toISOString();
}

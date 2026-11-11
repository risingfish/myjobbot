import { createHash, timingSafeEqual } from "node:crypto";

const MIN_LENGTH = 32;
const SCHEME = "Bearer ";

/** Gives the metrics token from the environment, or null when it is unset or shorter than 32 characters. */
export function metricsToken(env: Record<string, string | undefined>): string | null {
    const token = env.MYJOBBOT_METRICS_TOKEN;
    return token !== undefined && token.length >= MIN_LENGTH ? token : null;
}

/** Tells whether a request's Authorization header holds the metrics token as a bearer token, compared in constant time. */
export function tokenOk(header: string | undefined, token: string): boolean {
    if (header === undefined || !header.startsWith(SCHEME)) return false;
    const digest = (text: string) => createHash("sha256").update(text).digest();
    return timingSafeEqual(digest(header.slice(SCHEME.length)), digest(token));
}

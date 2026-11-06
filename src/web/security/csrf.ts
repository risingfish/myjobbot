import { tokenDigest } from "../../accounts/tokens.js";
import { isRead } from "./origin.js";

export interface CsrfInput {
    method: string;
    cookie: string | null;
    session: { csrfDigest: string } | null;
}

export type CsrfDecision = "pass" | "refuse" | "issue" | "rebind";

/** Says whether the browser's forgery cookie matches its sign-in's. */
function matches(cookie: string, session: CsrfInput["session"]): boolean {
    return session === null || tokenDigest(cookie) === session.csrfDigest;
}

/** Decides a request's forgery check: a change needs the cookie, tied to the sign-in; a read without a fitting one gets a new one. */
export function csrfDecision(input: CsrfInput): CsrfDecision {
    const fits = input.cookie !== null && matches(input.cookie, input.session);
    if (!isRead(input.method)) return fits ? "pass" : "refuse";
    if (fits) return "pass";
    return input.session === null ? "issue" : "rebind";
}

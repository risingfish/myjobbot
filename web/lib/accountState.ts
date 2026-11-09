import { eventLabel } from "../../src/accounts/events.js";
import { usable } from "../../src/accounts/methods.js";
import type { MethodKind } from "../../src/db/methodStore.js";
import type { Session } from "../../src/db/sessionStore.js";
import { authContext } from "./authDeps.js";
import { requireSession } from "./session.js";

export interface WayView {
    kind: MethodKind;
    enabled: boolean;
    ready: boolean;
    usable: boolean;
}

export interface EventView {
    at: string;
    label: string;
    method: string | null;
}

export interface SignInView {
    ref: string;
    current: boolean;
    os: string;
    ip: string;
    location: string;
    lastUsedAt: string;
}

export interface AccountState {
    name: string;
    email: string;
    ways: WayView[];
    signIns: SignInView[];
    events: EventView[];
    recoveryCodesLeft: number;
    keys: Array<{ id: number; name: string }>;
}

/** Turns one live sign-in into what the Sign-ins list shows, named by the start of its digest, never the digest itself. */
function signInView(session: Session, currentDigest: string): SignInView {
    const { device } = session;
    return { ref: session.idDigest.slice(0, 16), current: session.idDigest === currentDigest, os: device.os ?? "Unknown", ip: device.ip ?? "Unknown", location: device.location ?? "Unknown", lastUsedAt: session.lastUsedAt };
}

/** Returns what the Account page shows about the signed-in account, confirming the sign-in before anything is read. */
export async function getAccountState(): Promise<AccountState> {
    const { account, session } = await requireSession();
    const ctx = await authContext();
    const [rows, live, events, left, keys] = await Promise.all([ctx.stores.methods.methods(account.id), ctx.stores.sessions.activeFor(account.id, ctx.now()), ctx.stores.events.recent(account.id, 20), ctx.stores.recoveryCodes.left(account.id), ctx.stores.keys.keys(account.id)]);
    const ways = rows.map((row) => ({ ...row, usable: usable(row, { mailOn: ctx.mail !== null }) }));
    const signIns = live.map((row) => signInView(row, session.idDigest));
    return { name: account.name, email: account.email ?? "", ways, signIns, recoveryCodesLeft: left, keys, events: events.map((event) => ({ at: event.at, label: eventLabel(event.event), method: event.method })) };
}

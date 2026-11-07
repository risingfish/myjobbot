import type { MethodKind } from "../../db/methodStore.js";
import { MESSAGES } from "../messages.js";
import { checkName } from "../names.js";
import { wayEntry } from "../ways/catalog.js";
import type { Actor, AuthContext, Refused } from "./context.js";
import { recordSecurityEvent } from "./securityEvents.js";

/** Records a security event for the actor's account, at their address. */
function record(ctx: AuthContext, actor: Actor, event: { event: Parameters<typeof recordSecurityEvent>[1]["event"]; method: string | null }): Promise<void> {
    return recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, ...event });
}

/** Changes the signed-in account's name. */
export async function saveName(ctx: AuthContext, actor: Actor, raw: string): Promise<{ ok: true } | Refused> {
    const name = checkName(raw);
    if (!name.ok) return name;
    await ctx.stores.accounts.saveName(actor.account.id, name.name);
    return { ok: true };
}

/** Ends every sign-in of the account but this one. */
export async function signOutEverywhereElse(ctx: AuthContext, actor: Actor): Promise<void> {
    await ctx.stores.sessions.endAllFor(actor.account.id, ctx.now(), actor.session.idDigest);
    await record(ctx, actor, { event: "signed_out_elsewhere", method: null });
}

/** Switches a way of signing in on or off, never leaving none usable; switching on a way not set up asks for its setup. */
export async function setMethodEnabled(ctx: AuthContext, actor: Actor, change: { kind: MethodKind; enabled: boolean }): Promise<{ ok: true; setup?: MethodKind } | Refused> {
    if (wayEntry(change.kind).needsMail && change.enabled && ctx.mail === null) return { ok: false, message: MESSAGES.mail_off };
    const result = await ctx.stores.methods.setEnabled(actor.account.id, { ...change, mailOn: ctx.mail !== null }, ctx.now());
    if (result === "last_way") return { ok: false, message: MESSAGES.last_way };
    await record(ctx, actor, { event: change.enabled ? "method_enabled" : "method_disabled", method: change.kind });
    const row = (await ctx.stores.methods.methods(actor.account.id)).find((method) => method.kind === change.kind);
    return change.enabled && row?.ready === false ? { ok: true, setup: change.kind } : { ok: true };
}

/** Ends one of the account's other sign-ins, named by the start of its digest; this browser's own is signed out with Sign out instead. */
export async function signOutDevice(ctx: AuthContext, actor: Actor, ref: string): Promise<{ ok: true } | Refused> {
    const target = (await ctx.stores.sessions.activeFor(actor.account.id, ctx.now())).find((session) => session.idDigest.startsWith(ref) && ref.length >= 16);
    if (target === undefined || target.idDigest === actor.session.idDigest) return { ok: false, message: MESSAGES.device_gone };
    await ctx.stores.sessions.end(target.idDigest, ctx.now());
    await record(ctx, actor, { event: "device_signed_out", method: null });
    return { ok: true };
}

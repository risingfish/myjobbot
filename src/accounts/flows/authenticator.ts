import QRCode from "qrcode";
import { openOrNull, seal } from "../../gmail/seal.js";
import { MESSAGES } from "../messages.js";
import { checkCode, newAuthenticator } from "../totp.js";
import type { Actor, AuthContext, Refused } from "./context.js";
import { recordWayAdded } from "./recoveryCodes.js";
import { recordSecurityEvent } from "./securityEvents.js";
import { signInWith, type SignInAnswer, type SignInRequest } from "./signIn.js";

/** Says whether a code from the account's app is right for now and newer than the last one used, accepting its step; a setup not yet confirmed counts only when asked. */
export async function appCodeMatches(ctx: AuthContext, userId: number, check: { code: string; duringSetup?: boolean }): Promise<boolean> {
    const app = await ctx.stores.methods.authenticator(userId);
    const allowed = app.enabled && (app.ready || check.duringSetup === true);
    const secret = !allowed || app.sealedSecret === null || ctx.secretKey === null ? null : openOrNull(app.sealedSecret, "totp_secret", ctx.secretKey);
    const step = secret === null ? null : checkCode(secret, check.code.trim(), ctx.now());
    return step !== null && (await ctx.stores.methods.acceptStep(userId, step));
}

/** Starts setting up an authenticator app: a new secret, stored sealed and not yet set up, shown once as a QR code and as text. */
export async function startAuthenticatorSetup(ctx: AuthContext, actor: Actor): Promise<{ ok: true; qr: string; secret: string } | Refused> {
    if (ctx.secretKey === null) return { ok: false, message: MESSAGES.secret_key_missing };
    const app = newAuthenticator(ctx.random, actor.account.email ?? "");
    await ctx.stores.methods.saveAuthenticator(actor.account.id, { sealedSecret: seal(app.secret, "totp_secret", ctx.secretKey), ready: false }, ctx.now());
    return { ok: true, qr: await QRCode.toDataURL(app.uri), secret: app.secret };
}

/** Finishes the setup once the app shows a right code, giving ten recovery codes the first time the account has none. */
export async function confirmAuthenticator(ctx: AuthContext, actor: Actor, code: string): Promise<{ ok: true; recoveryCodes: string[] | null } | Refused> {
    const app = await ctx.stores.methods.authenticator(actor.account.id);
    if (app.sealedSecret === null || !(await appCodeMatches(ctx, actor.account.id, { code, duringSetup: true }))) return { ok: false, message: MESSAGES.code_wrong };
    await ctx.stores.methods.saveAuthenticator(actor.account.id, { sealedSecret: app.sealedSecret, ready: true }, ctx.now());
    return { ok: true, recoveryCodes: await recordWayAdded(ctx, actor, { event: "app_added", method: "authenticator" }) };
}

/** Removes the account's authenticator app, never when it is the last usable way. */
export async function removeAuthenticator(ctx: AuthContext, actor: Actor): Promise<{ ok: true } | Refused> {
    if ((await ctx.stores.methods.removeAuthenticator(actor.account.id, { mailOn: ctx.mail !== null }, ctx.now())) === "last_way") return { ok: false, message: MESSAGES.last_way };
    await recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, event: "app_removed", method: "authenticator" });
    return { ok: true };
}

/** Signs in with an email and a current code from the account's app, under the shared limits. */
export function signInWithAuthenticator(ctx: AuthContext, input: SignInRequest & { code: string }): Promise<SignInAnswer> {
    return signInWith(ctx, input, { method: "authenticator", matches: async (account) => account !== null && appCodeMatches(ctx, account.id, { code: input.code }) });
}

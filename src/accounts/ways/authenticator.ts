import QRCode from "qrcode";
import { openOrNull, seal } from "../../gmail/seal.js";
import { MESSAGES } from "../messages.js";
import { checkCode, newAuthenticator } from "../totp.js";
import type { Actor, AuthContext, Refused } from "../flows/context.js";
import { recordWayAdded } from "./recoveryCode.js";
import { recordSecurityEvent } from "../flows/securityEvents.js";
import type { ProofWay } from "./registry.js";

/** Says whether a code from the account's app is right for now and newer than the last one used, accepting its step; a setup not yet confirmed counts only when asked. */
async function appCodeMatches(ctx: AuthContext, userId: number, check: { code: string; duringSetup?: boolean }): Promise<boolean> {
    const app = await ctx.stores.authenticators.authenticator(userId);
    const allowed = app.enabled && (app.ready || check.duringSetup === true);
    const secret = !allowed || app.sealedSecret === null || ctx.secretKey === null ? null : openOrNull(app.sealedSecret, "totp_secret", ctx.secretKey);
    const step = secret === null ? null : checkCode(secret, check.code.trim(), ctx.now());
    return step !== null && (await ctx.stores.authenticators.acceptStep(userId, step));
}

/** Starts setting up an authenticator app: a new secret, stored sealed and not yet set up, shown once as a QR code and as text. */
export async function startAuthenticatorSetup(ctx: AuthContext, actor: Actor): Promise<{ ok: true; qr: string; secret: string } | Refused> {
    if (ctx.secretKey === null) return { ok: false, message: MESSAGES.secret_key_missing };
    const app = newAuthenticator(ctx.random, actor.account.email ?? "");
    await ctx.stores.authenticators.saveAuthenticator(actor.account.id, { sealedSecret: seal(app.secret, "totp_secret", ctx.secretKey), ready: false }, ctx.now());
    return { ok: true, qr: await QRCode.toDataURL(app.uri), secret: app.secret };
}

/** Finishes the setup once the app shows a right code, giving ten recovery codes the first time the account has none. */
export async function confirmAuthenticator(ctx: AuthContext, actor: Actor, code: string): Promise<{ ok: true; recoveryCodes: string[] | null } | Refused> {
    const app = await ctx.stores.authenticators.authenticator(actor.account.id);
    if (app.sealedSecret === null || !(await appCodeMatches(ctx, actor.account.id, { code, duringSetup: true }))) return { ok: false, message: MESSAGES.code_wrong };
    await ctx.stores.authenticators.saveAuthenticator(actor.account.id, { sealedSecret: app.sealedSecret, ready: true }, ctx.now());
    return { ok: true, recoveryCodes: await recordWayAdded(ctx, actor, { event: "app_added", method: "authenticator" }) };
}

/** Removes the account's authenticator app, never when it is the last usable way. */
export async function removeAuthenticator(ctx: AuthContext, actor: Actor): Promise<{ ok: true } | Refused> {
    if ((await ctx.stores.authenticators.removeAuthenticator(actor.account.id, { mailOn: ctx.mail !== null }, ctx.now())) === "last_way") return { ok: false, message: MESSAGES.last_way };
    await recordSecurityEvent(ctx, { userId: actor.account.id, at: ctx.now(), address: actor.address, event: "app_removed", method: "authenticator" });
    return { ok: true };
}

export const authenticatorWay: ProofWay = {
    kind: "authenticator",
    readProof: (fields) => (typeof fields.code === "string" ? { code: fields.code } : null),
    matches: async (ctx, account, proof) => account !== null && appCodeMatches(ctx, account.id, { code: proof.code ?? "" }),
};

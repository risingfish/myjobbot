import type { Device } from "../../db/sessionStore.js";
import { newToken, tokenDigest } from "../tokens.js";
import type { AuthContext } from "./context.js";

export interface SessionCookies {
    session: string;
    csrf: string;
}

const UNKNOWN_DEVICE: Device = { ip: null, os: null, location: null };

/** Starts a new sign-in for an account, ending the one the browser held, and returns its cookie values. */
export async function startSession(ctx: AuthContext, input: { userId: number; address: string; heldDigest: string | null; device?: Device }): Promise<SessionCookies> {
    const now = ctx.now();
    if (input.heldDigest !== null) await ctx.stores.sessions.end(input.heldDigest, now);
    await ctx.stores.sessions.pruneEnded(now);
    const cookies = { session: newToken(ctx.random), csrf: newToken(ctx.random) };
    await ctx.stores.sessions.create({ idDigest: tokenDigest(cookies.session), userId: input.userId, csrfDigest: tokenDigest(cookies.csrf), createdAt: now, lastUsedAt: now, verifiedAt: now, address: input.address, device: input.device ?? UNKNOWN_DEVICE });
    return cookies;
}

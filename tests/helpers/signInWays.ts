import type { AuthContext } from "../../src/accounts/flows/context.js";
import { signInByWay, type SignInAnswer, type SignInRequest } from "../../src/accounts/flows/signIn.js";

export function signInWithPassword(ctx: AuthContext, input: SignInRequest & { password: string }): Promise<SignInAnswer> {
    return signInByWay(ctx, input, { kind: "password", fields: { password: input.password } });
}

export function signInWithAuthenticator(ctx: AuthContext, input: SignInRequest & { code: string }): Promise<SignInAnswer> {
    return signInByWay(ctx, input, { kind: "authenticator", fields: { code: input.code } });
}

export function signInWithRecoveryCode(ctx: AuthContext, input: SignInRequest & { code: string }): Promise<SignInAnswer> {
    return signInByWay(ctx, input, { kind: "recovery_code", fields: { code: input.code } });
}

export function finishKeySignIn(ctx: AuthContext, input: SignInRequest & { response: unknown }): Promise<SignInAnswer> {
    return signInByWay(ctx, input, { kind: "hardware_key", fields: { response: input.response } });
}

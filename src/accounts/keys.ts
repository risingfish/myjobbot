import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import type { NewKey, StoredKey } from "../db/keyStore.js";
import type { RelyingParty } from "./flows/context.js";

type ChallengeCheck = (challenge: string) => Promise<boolean>;

/** Returns the options a browser registers a key with: this site, the account, a key that remembers the site, and none of the account's keys again. */
export function registrationOptions(rp: RelyingParty, account: { id: number; email: string }, existing: Array<{ credentialId: string; transports: string[] }>): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
        rpName: "myjobbot",
        rpID: rp.id,
        userName: account.email,
        userID: new TextEncoder().encode(`myjobbot-${account.id}`),
        attestationType: "none",
        authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
        excludeCredentials: existing.map((key) => ({ id: key.credentialId, transports: key.transports })),
    });
}

/** Checks a browser's registration answer against this site and a challenge spent as it is checked, giving the key to store, or null. */
export async function verifiedCredential(response: RegistrationResponseJSON, check: { rp: RelyingParty; challenge: ChallengeCheck }): Promise<Omit<NewKey, "name"> | null> {
    try {
        const result = await verifyRegistrationResponse({ response, expectedChallenge: check.challenge, expectedOrigin: check.rp.origin, expectedRPID: check.rp.id });
        if (!result.verified) return null;
        const { credential } = result.registrationInfo;
        return { credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, transports: credential.transports ?? [] };
    } catch {
        return null;
    }
}

/** Returns the options a browser signs in with: this site and a fresh challenge, naming no key, so they say nothing about any account. */
export function signInOptions(rp: RelyingParty): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions({ rpID: rp.id, userVerification: "preferred" });
}

/** Checks a browser's sign-in answer against a stored key, this site and a challenge spent as it is checked, giving the key's new counter, or null. */
export async function verifiedSignIn(response: AuthenticationResponseJSON, check: { rp: RelyingParty; key: StoredKey; challenge: ChallengeCheck }): Promise<number | null> {
    try {
        const credential = { id: check.key.credentialId, publicKey: new Uint8Array(Buffer.from(check.key.publicKey, "base64url")), counter: check.key.counter, transports: check.key.transports };
        const result = await verifyAuthenticationResponse({ response, expectedChallenge: check.challenge, expectedOrigin: check.rp.origin, expectedRPID: check.rp.id, credential });
        return result.verified ? result.authenticationInfo.newCounter : null;
    } catch {
        return null;
    }
}

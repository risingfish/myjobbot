let issued = 0;

export const fakeWebAuthn = {
    registrationOptions: null as Record<string, unknown> | null,
    registration: { verified: true, credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["usb"] } },
    authentication: { verified: true, newCounter: 1 },
};

export const fakeServer = {
    generateRegistrationOptions: async (options: Record<string, unknown>) => {
        fakeWebAuthn.registrationOptions = options;
        issued += 1;
        return { challenge: `register-${issued}`, rp: { id: options.rpID } };
    },
    generateAuthenticationOptions: async (options: Record<string, unknown>) => {
        issued += 1;
        return { challenge: `signin-${issued}`, rpId: options.rpID, allowCredentials: options.allowCredentials ?? [] };
    },
    verifyRegistrationResponse: async (options: { response: { challenge: string }; expectedChallenge: (challenge: string) => Promise<boolean>; expectedOrigin: string; expectedRPID: string }) => {
        if (!(await options.expectedChallenge(options.response.challenge))) throw new Error("challenge refused");
        return fakeWebAuthn.registration.verified ? { verified: true, registrationInfo: { credential: fakeWebAuthn.registration.credential } } : { verified: false };
    },
    verifyAuthenticationResponse: async (options: { response: { challenge: string }; expectedChallenge: (challenge: string) => Promise<boolean> }) => {
        if (!(await options.expectedChallenge(options.response.challenge))) throw new Error("challenge refused");
        return { verified: fakeWebAuthn.authentication.verified, authenticationInfo: { newCounter: fakeWebAuthn.authentication.newCounter } };
    },
};

"use client";

import { useState } from "react";
import { confirmAuthenticator, removeAuthenticator, startAuthenticatorSetup } from "../../lib/authenticatorActions.js";
import { Field } from "./Field.js";
import { CodesShown } from "./RecoveryCodes.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

type Setup = { qr: string; secret: string } | { codes: string[] } | null;

/** Renders the setup in progress: the QR code to scan, the secret to type instead, and the code that confirms it. */
function SetupSteps({ setup, onCodes }: { setup: { qr: string; secret: string }; onCodes: (codes: string[] | null) => void }) {
    const [refusal, setRefusal] = useState<string | null>(null);
    const confirm = async (form: FormData) => {
        const answer = await confirmAuthenticator(String(form.get("app-code") ?? ""));
        if (answer.ok) return onCodes(answer.recoveryCodes);
        setRefusal(answer.message);
    };
    return (
        <form action={confirm}>
            <figure>
                <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} />
                <figcaption>
                    Or type this key: <code>{setup.secret}</code>
                </figcaption>
            </figure>
            <Field name="app-code" label="Code from your app" autoComplete="one-time-code" inputMode="numeric" required invalid={refusal !== null} note={refusal} />
            <button>Confirm</button>
        </form>
    );
}

/** Renders the authenticator's controls: Remove app once set up, else Start setup, then its steps, then the first recovery codes once. */
export function AuthenticatorControls({ ready }: { ready: boolean }) {
    const run = useStepUp();
    const [setup, setSetup] = useState<Setup>(null);
    const [refusal, setRefusal] = useState<string | null>(null);
    const start = async () => {
        const answer = await run(() => startAuthenticatorSetup());
        if (answer.ok) setSetup({ qr: answer.qr, secret: answer.secret });
        else setRefusal(shownRefusal(answer));
    };
    const remove = async () => setRefusal(shownRefusal(await run(() => removeAuthenticator())));
    if (setup !== null && "codes" in setup) return <CodesShown codes={setup.codes} onSaved={() => setSetup(null)} />;
    if (setup !== null) return <SetupSteps setup={setup} onCodes={(codes) => setSetup(codes === null ? null : { codes })} />;
    return (
        <form action={ready ? remove : start}>
            <button className={ready ? "secondary" : undefined}>{ready ? "Remove app" : "Start setup"}</button>
            {refusal !== null && <p role="alert">{refusal}</p>}
        </form>
    );
}

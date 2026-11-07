"use client";

import { useState } from "react";
import { makeRecoveryCodes } from "../../lib/authenticatorActions.js";
import { Panel } from "../sections/Panel.js";
import { useStepUp } from "./StepUp.js";

/** Shows a new set of recovery codes once, one per line, with the button that hides them for good. */
export function CodesShown({ codes, onSaved }: { codes: string[]; onSaved: () => void }) {
    return (
        <>
            <p>Keep these recovery codes somewhere safe. Each one signs you in once, and they aren&apos;t shown again.</p>
            <pre>
                <code>{codes.join("\n")}</code>
            </pre>
            <form action={onSaved}>
                <button>I&apos;ve saved them</button>
            </form>
        </>
    );
}

/** Renders the Recovery codes section: how many are left, and the button that makes a new set, shown once. */
export function RecoveryCodesPanel({ left }: { left: number }) {
    const run = useStepUp();
    const [codes, setCodes] = useState<string[] | null>(null);
    const make = async () => {
        const answer = await run(() => makeRecoveryCodes());
        if (answer.ok) setCodes(answer.codes);
    };
    if (codes !== null) return <Panel title="Recovery codes">{<CodesShown codes={codes} onSaved={() => setCodes(null)} />}</Panel>;
    return (
        <Panel title="Recovery codes">
            <p>{left === 0 ? "You have no recovery codes." : `${left} of 10 recovery codes left.`} Each one signs you in once if you lose your app or key.</p>
            <form action={make}>
                <button>Make new codes</button>
            </form>
        </Panel>
    );
}

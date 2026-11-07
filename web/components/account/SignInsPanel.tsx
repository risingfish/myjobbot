"use client";

import { useState } from "react";
import { signOutDevice, signOutEverywhereElse } from "../../lib/accountActions.js";
import type { SignInView } from "../../lib/accountState.js";
import { Panel } from "../sections/Panel.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

/** Renders the last cell of a sign-in's row: This device for the browser in use, else a button that signs that device out. */
function SignOutCell({ signIn, onSignOut }: { signIn: SignInView; onSignOut: (ref: string) => void }) {
    if (signIn.current) return <small>This device</small>;
    return (
        <button type="button" className="secondary outline" onClick={() => onSignOut(signIn.ref)}>
            Sign out
        </button>
    );
}

/** Renders one live sign-in's row: its device's OS, IP and location, when it was last used, and its Sign out. */
function SignInRow({ signIn, onSignOut }: { signIn: SignInView; onSignOut: (ref: string) => void }) {
    return (
        <tr>
            <td>{signIn.os}</td>
            <td>{signIn.ip}</td>
            <td>{signIn.location}</td>
            <td>
                <time dateTime={signIn.lastUsedAt}>{signIn.lastUsedAt.slice(0, 16).replace("T", " ")} UTC</time>
            </td>
            <td>
                <SignOutCell signIn={signIn} onSignOut={onSignOut} />
            </td>
        </tr>
    );
}

/** Renders the table of the account's live sign-ins. */
function SignInsTable({ signIns, onSignOut }: { signIns: SignInView[]; onSignOut: (ref: string) => void }) {
    return (
        <table className="striped" aria-label="Sign-ins">
            <thead>
                <tr>
                    <th>Device</th>
                    <th>IP address</th>
                    <th>Location</th>
                    <th>Last used</th>
                    <th />
                </tr>
            </thead>
            <tbody>
                {signIns.map((signIn) => (
                    <SignInRow key={signIn.ref} signIn={signIn} onSignOut={onSignOut} />
                ))}
            </tbody>
        </table>
    );
}

/** Renders the Sign-ins section: every live sign-in with its device, a Sign out for each other one, and Sign out everywhere else. */
export function SignInsPanel({ signIns }: { signIns: SignInView[] }) {
    const run = useStepUp();
    const [note, setNote] = useState<string | null>(null);
    const signOutOne = async (ref: string) => {
        const answer = await signOutDevice(ref);
        setNote(answer.ok ? "That device is signed out." : shownRefusal(answer));
    };
    const signOutOthers = async () => setNote((await run(() => signOutEverywhereElse())).ok ? "Every other sign-in has ended." : null);
    const actions = (
        <button type="button" className="secondary" onClick={() => void signOutOthers()}>
            Sign out everywhere else
        </button>
    );
    return (
        <Panel title="Sign-ins" actions={actions}>
            <SignInsTable signIns={signIns} onSignOut={(ref) => void signOutOne(ref)} />
            {note !== null && <p role="status">{note}</p>}
        </Panel>
    );
}

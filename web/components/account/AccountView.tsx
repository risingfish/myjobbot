"use client";

import { useState } from "react";
import type { MethodKind } from "../../../src/db/methodStore.js";
import { saveName, setMethodEnabled } from "../../lib/accountActions.js";
import type { AccountState, EventView, WayView } from "../../lib/accountState.js";
import { Panel } from "../sections/Panel.js";
import { SettingCard } from "../settings/SettingParts.js";
import { EmailChange } from "./EmailChange.js";
import { SignInsPanel } from "./SignInsPanel.js";
import { shownRefusal, StepUpProvider, useStepUp } from "./StepUp.js";
import { WayCard } from "./WayCard.js";

/** Renders the name with its Save button, and whether the save went through. */
function NameForm({ name }: { name: string }) {
    const [note, setNote] = useState<{ ok: boolean; message?: string } | null>(null);
    const save = async (form: FormData) => setNote(await saveName(String(form.get("name") ?? "")));
    return (
        <form action={save}>
            <label htmlFor="name">Name</label>
            <fieldset role="group">
                <input id="name" name="name" autoComplete="name" defaultValue={name} required aria-invalid={note?.ok === false || undefined} />
                <button type="submit">Save</button>
            </fieldset>
            {note !== null && <small role={note.ok ? "status" : "alert"}>{note.ok ? "Saved." : note.message}</small>}
        </form>
    );
}

/** Renders the User Profile section: the Details card with the name and the email the account signs in with. */
function ProfilePanel({ name, email }: { name: string; email: string }) {
    return (
        <Panel title="User Profile">
            <SettingCard title="Details">
                <NameForm name={name} />
                <EmailChange email={email} />
            </SettingCard>
        </Panel>
    );
}

/** Renders the Ways of signing in section: the four ways as cards, two to a row, with why a switch was refused. */
function WaysPanel({ ways }: { ways: WayView[] }) {
    const run = useStepUp();
    const [refusal, setRefusal] = useState<string | null>(null);
    const switchWay = async (kind: MethodKind, enabled: boolean) => {
        const answer = await run(() => setMethodEnabled(kind, enabled));
        setRefusal(shownRefusal(answer));
    };
    const usableCount = ways.filter((way) => way.usable).length;
    const card = (way: WayView) => <WayCard key={way.kind} way={way} only={way.usable && usableCount === 1} onSwitch={(kind, enabled) => void switchWay(kind, enabled)} />;
    return (
        <Panel title="Ways of signing in">
            {refusal !== null && <p role="alert">{refusal}</p>}
            <div className="grid">{ways.slice(0, 2).map(card)}</div>
            <div className="grid">{ways.slice(2).map(card)}</div>
        </Panel>
    );
}

/** Renders the Recent activity section: the account's last 20 security events as text. */
function ActivityPanel({ events }: { events: EventView[] }) {
    return (
        <Panel title="Recent activity">
            <table className="striped" aria-label="Recent activity">
                <tbody>
                    {events.map((event, index) => (
                        <tr key={`${event.at}-${index}`}>
                            <td>
                                <time dateTime={event.at}>{event.at.slice(0, 16).replace("T", " ")} UTC</time>
                            </td>
                            <td>{event.label}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Panel>
    );
}

/** Renders the Account tab in the Settings layout: User Profile, Ways of signing in, Sign-ins and Recent activity, sensitive changes asking to confirm it's you. */
export function AccountView({ state }: { state: AccountState }) {
    return (
        <StepUpProvider>
            <ProfilePanel name={state.name} email={state.email} />
            <WaysPanel ways={state.ways} />
            <SignInsPanel signIns={state.signIns} />
            <ActivityPanel events={state.events} />
        </StepUpProvider>
    );
}

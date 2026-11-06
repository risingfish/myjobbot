"use client";

import type { MethodKind } from "../../../src/db/methodStore.js";
import type { WayView } from "../../lib/accountState.js";
import { SettingCard } from "../settings/SettingParts.js";
import { PasswordControls } from "./PasswordControls.js";

const WAY_NAMES: Record<MethodKind, string> = { password: "Password", email_link: "Email me a link", hardware_key: "Hardware keys", authenticator: "Authenticator app" };

/** Renders one way's controls: the password form, or a note until that way's setup is built. */
function WayControls({ kind }: { kind: MethodKind }) {
    if (kind === "password") return <PasswordControls />;
    return <p>Setting up {WAY_NAMES[kind].toLowerCase()} comes in a later update.</p>;
}

/** Renders one way of signing in as a card: its switch, locked on while it is the only usable way, whether it is set up, and, while it is turned on, its controls. */
export function WayCard({ way, only, onSwitch }: { way: WayView; only: boolean; onSwitch: (kind: MethodKind, enabled: boolean) => void }) {
    return (
        <SettingCard title={WAY_NAMES[way.kind]}>
            <label>
                <input type="checkbox" role="switch" name={way.kind} aria-label={WAY_NAMES[way.kind]} aria-describedby={`${way.kind}-state`} checked={way.enabled} disabled={only} onChange={(event) => onSwitch(way.kind, event.target.checked)} />
                Turned on
            </label>
            <small id={`${way.kind}-state`}>{only ? "Your only way to sign in, so it stays on" : way.ready ? "Set up" : "Not set up"}</small>
            {way.enabled && <WayControls kind={way.kind} />}
        </SettingCard>
    );
}

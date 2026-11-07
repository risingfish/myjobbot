"use client";

import type { MethodKind } from "../../../src/db/methodStore.js";
import type { WayView } from "../../lib/accountState.js";
import { SettingCard } from "../settings/SettingParts.js";
import { AuthenticatorControls } from "./AuthenticatorControls.js";
import { EmailLinkControls } from "./EmailLinkControls.js";
import { PasswordControls } from "./PasswordControls.js";

const WAY_NAMES: Record<MethodKind, string> = { password: "Password", email_link: "Email me a link", hardware_key: "Hardware keys", authenticator: "Authenticator app" };

/** Renders one way's controls: the password form, the test email, the authenticator setup, or a note until that way's setup is built. */
function WayControls({ kind, ready }: { kind: MethodKind; ready: boolean }) {
    if (kind === "password") return <PasswordControls />;
    if (kind === "email_link") return <EmailLinkControls />;
    if (kind === "authenticator") return <AuthenticatorControls ready={ready} />;
    return <p>Setting up {WAY_NAMES[kind].toLowerCase()} comes in a later update.</p>;
}

/** Renders one way of signing in as a card: its switch, locked on while it is the only usable way, and, while it is turned on, its controls. */
export function WayCard({ way, only, onSwitch }: { way: WayView; only: boolean; onSwitch: (kind: MethodKind, enabled: boolean) => void }) {
    return (
        <SettingCard title={WAY_NAMES[way.kind]}>
            <label>
                <input type="checkbox" role="switch" name={way.kind} aria-label={WAY_NAMES[way.kind]} checked={way.enabled} disabled={only} onChange={(event) => onSwitch(way.kind, event.target.checked)} />
                Turned on
            </label>
            {way.enabled && <WayControls kind={way.kind} ready={way.ready} />}
        </SettingCard>
    );
}

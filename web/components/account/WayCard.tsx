"use client";

import type { MethodKind } from "../../../src/db/methodStore.js";
import type { WayView } from "../../lib/accountState.js";
import { SettingCard } from "../settings/SettingParts.js";
import { AuthenticatorControls } from "./AuthenticatorControls.js";
import { EmailLinkControls } from "./EmailLinkControls.js";
import { KeyControls } from "./KeyControls.js";
import { PasswordControls } from "./PasswordControls.js";

const WAY_NAMES: Record<MethodKind, string> = { password: "Password", email_link: "Email me a link", hardware_key: "Hardware keys", authenticator: "Authenticator app" };

/** Renders one way's controls: the password form, the test email, the authenticator setup, or the hardware keys. */
function WayControls({ kind, ready, keys }: { kind: MethodKind; ready: boolean; keys: Array<{ id: number; name: string }> }) {
    if (kind === "password") return <PasswordControls />;
    if (kind === "email_link") return <EmailLinkControls />;
    if (kind === "authenticator") return <AuthenticatorControls ready={ready} />;
    return <KeyControls keys={keys} />;
}

/** Renders one way of signing in as a card: its switch, locked on while it is the only usable way, and, while it is turned on, its controls. */
export function WayCard({ way, only, keys, onSwitch }: { way: WayView; only: boolean; keys: Array<{ id: number; name: string }>; onSwitch: (kind: MethodKind, enabled: boolean) => void }) {
    return (
        <SettingCard title={WAY_NAMES[way.kind]}>
            <label>
                <input type="checkbox" role="switch" name={way.kind} aria-label={WAY_NAMES[way.kind]} checked={way.enabled} disabled={only} onChange={(event) => onSwitch(way.kind, event.target.checked)} />
                Turned on
            </label>
            {way.enabled && <WayControls kind={way.kind} ready={way.ready} keys={keys} />}
        </SettingCard>
    );
}

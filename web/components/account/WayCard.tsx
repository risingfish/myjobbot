"use client";

import type { ReactNode } from "react";
import { cardName } from "../../../src/accounts/ways/catalog.js";
import type { MethodKind } from "../../../src/db/methodStore.js";
import type { WayView } from "../../lib/accountState.js";
import { SettingCard } from "../settings/SettingParts.js";
import { AuthenticatorControls } from "./AuthenticatorControls.js";
import { EmailLinkControls } from "./EmailLinkControls.js";
import { KeyControls } from "./KeyControls.js";
import { PasswordControls } from "./PasswordControls.js";

const CONTROLS: Record<MethodKind, (props: { ready: boolean; keys: Array<{ id: number; name: string }> }) => ReactNode> = {
    password: () => <PasswordControls />,
    email_link: () => <EmailLinkControls />,
    authenticator: ({ ready }) => <AuthenticatorControls ready={ready} />,
    hardware_key: ({ keys }) => <KeyControls keys={keys} />,
};

/** Renders one way of signing in as a card: its switch, locked on while it is the only usable way, and, while it is turned on, its controls. */
export function WayCard({ way, only, keys, onSwitch }: { way: WayView; only: boolean; keys: Array<{ id: number; name: string }>; onSwitch: (kind: MethodKind, enabled: boolean) => void }) {
    return (
        <SettingCard title={cardName(way.kind)}>
            <label>
                <input type="checkbox" role="switch" name={way.kind} aria-label={cardName(way.kind)} checked={way.enabled} disabled={only} onChange={(event) => onSwitch(way.kind, event.target.checked)} />
                Turned on
            </label>
            {way.enabled && CONTROLS[way.kind]({ ready: way.ready, keys })}
        </SettingCard>
    );
}

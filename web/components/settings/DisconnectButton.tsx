"use client";

import { useTransition } from "react";
import { disconnectGmail } from "../../lib/gmailActions.js";

const CONFIRM = "Disconnect Gmail? myjobbot will forget the app password. To revoke it, also delete it at https://myaccount.google.com/apppasswords.";

/** Renders the Disconnect button, which asks for confirmation and reminds the owner to delete the app password in Google. */
export function DisconnectButton() {
    const [disconnecting, startDisconnect] = useTransition();
    const run = () => {
        if (!window.confirm(CONFIRM)) return;
        startDisconnect(async () => void (await disconnectGmail()));
    };
    return (
        <button type="button" onClick={run} disabled={disconnecting}>
            Disconnect
        </button>
    );
}

"use client";

import { useState, useTransition } from "react";
import { disconnectGmail } from "../../lib/gmailActions.js";

/** Renders the Disconnect button, which asks for confirmation and warns when Google didn't confirm the revoke. */
export function DisconnectButton() {
    const [unrevoked, setUnrevoked] = useState(false);
    const [disconnecting, startDisconnect] = useTransition();
    const run = () => {
        if (!window.confirm("Disconnect Gmail? myjobbot will ask Google to revoke its access.")) return;
        startDisconnect(async () => setUnrevoked(!(await disconnectGmail()).revoked));
    };
    return (
        <div>
            <button type="button" onClick={run} disabled={disconnecting}>
                Disconnect
            </button>
            {unrevoked && <p className="note">Disconnected, but the revoke may need to be done in your Google account.</p>}
        </div>
    );
}

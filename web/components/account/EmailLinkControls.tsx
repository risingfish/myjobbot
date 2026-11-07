"use client";

import { useState } from "react";
import { sendTestEmail } from "../../lib/accountActions.js";

/** Renders the email link's controls: what the way does, a button that sends a test mail, and whether it went. */
export function EmailLinkControls() {
    const [note, setNote] = useState<string | null>(null);
    const send = async () => {
        const answer = await sendTestEmail();
        setNote(answer.ok ? "A test email is on its way." : answer.message);
    };
    return (
        <>
            <p>On the sign-in page, choose Email me a link: a link that works once, for 15 minutes, goes to your email.</p>
            <form action={send}>
                <button>Send test email</button>
            </form>
            {note !== null && <p role="status">{note}</p>}
        </>
    );
}

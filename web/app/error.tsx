"use client";

import { MESSAGES } from "../../src/accounts/messages.js";

/** Shows that a page failed to load with a fixed message; the detail stays in the server log. */
export default function ErrorPage() {
    return (
        <main className="container-fluid" aria-label="Error">
            <p className="error">{MESSAGES.page_failed}</p>
        </main>
    );
}

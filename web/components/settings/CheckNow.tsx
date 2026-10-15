"use client";

import { useState, useTransition } from "react";
import type { CheckResult } from "../../../src/gmail/check.js";
import { checkGmail } from "../../lib/gmailActions.js";

/** Renders the Check now button and what the inbox check found. */
export function CheckNow() {
    const [result, setResult] = useState<CheckResult | null>(null);
    const [checking, startCheck] = useTransition();
    const run = () => startCheck(async () => setResult(await checkGmail()));
    return (
        <div className="check-now">
            <button type="button" onClick={run} disabled={checking}>
                Check now
            </button>
            {result && <CheckOutcome result={result} />}
        </div>
    );
}

/** Renders a check's count and newest alerts, or the reason it failed. */
function CheckOutcome({ result }: { result: CheckResult }) {
    if (!result.ok) return <p className="note">{result.reason}</p>;
    return (
        <>
            <p>{`${result.count} job-alert emails in the last 7 days; the connection works.`}</p>
            <ul>
                {result.newest.map((alert, index) => (
                    <li key={index}>{`${alert.from}: ${alert.subject} (${alert.date})`}</li>
                ))}
            </ul>
        </>
    );
}

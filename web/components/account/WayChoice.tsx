"use client";

import { Field } from "./Field.js";

export type Way = "password" | "authenticator" | "recovery_code" | "hardware_key";

const WAYS: Array<[Way, string]> = [
    ["password", "Password"],
    ["authenticator", "Authenticator app"],
    ["recovery_code", "Recovery code"],
    ["hardware_key", "Hardware key"],
];

/** Renders the choice of how to prove it's you, as a row of radios, and the field that way needs. */
export function WayChoice({ way, onWay, refusal, legend = "Sign in with" }: { way: Way; onWay: (way: Way) => void; refusal: string | null; legend?: string }) {
    const field = way === "password" ? { name: "password", label: "Password", type: "password", autoComplete: "current-password" } : { name: "code", label: way === "authenticator" ? "Code from your app" : "Recovery code", type: "text", autoComplete: "one-time-code" };
    return (
        <>
            <fieldset>
                <legend>{legend}</legend>
                {WAYS.map(([value, label]) => (
                    <label key={value}>
                        <input type="radio" name="way" value={value} checked={way === value} onChange={() => onWay(value)} />
                        {label}
                    </label>
                ))}
            </fieldset>
            {way === "hardware_key" ? <p role={refusal === null ? undefined : "alert"}>{refusal ?? "Touch your key when your browser asks."}</p> : <Field key={field.name} {...field} required invalid={refusal !== null} note={refusal} />}
        </>
    );
}

"use client";

import { CHOICE_KINDS, choiceOf, type ChoiceKind } from "../../../src/accounts/ways/catalog.js";
import { Field } from "./Field.js";

/** Renders the choice of how to prove it's you, as a row of radios, and the field that way needs. */
export function WayChoice({ way, onWay, refusal, legend = "Sign in with" }: { way: ChoiceKind; onWay: (way: ChoiceKind) => void; refusal: string | null; legend?: string }) {
    const { field } = choiceOf(way);
    return (
        <>
            <fieldset>
                <legend>{legend}</legend>
                {CHOICE_KINDS.map((value) => (
                    <label key={value}>
                        <input type="radio" name="way" value={value} checked={way === value} onChange={() => onWay(value)} />
                        {choiceOf(value).name}
                    </label>
                ))}
            </fieldset>
            {field.kind === "key" ? <p role={refusal === null ? undefined : "alert"}>{refusal ?? "Touch your key when your browser asks."}</p> : <Field key={field.name} name={field.name} label={field.label} type={field.type} autoComplete={field.autoComplete} required invalid={refusal !== null} note={refusal} />}
        </>
    );
}

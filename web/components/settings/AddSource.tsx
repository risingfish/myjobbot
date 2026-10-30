"use client";

import { useState, useTransition, type FormEvent } from "react";
import { paramValues, type SourceChoice, type SourceDraft } from "../../../src/web/sourceForm.js";
import { recognizeSourceLink } from "../../lib/sourceActions.js";

const NOT_SUPPORTED = "Not a supported job board link (Greenhouse, Lever, Ashby, Workday). Choose a source type below to fill it in by hand.";

interface AddSourceProps {
    choices: SourceChoice[];
    onOpen: (draft: SourceDraft) => void;
}

/** Renders the two ways to add a source: a box for a pasted jobs page link, which opens its form filled in, and the list of source types. */
export function AddSource({ choices, onOpen }: AddSourceProps) {
    return (
        <section aria-label="Add a source">
            <h5>Add a source</h5>
            <LinkBox choices={choices} onOpen={onOpen} />
            <ChoiceList choices={choices} onOpen={onOpen} />
        </section>
    );
}

/** Renders the box for a pasted jobs page link, opening the form of the source type it belongs to, filled in, or saying the link isn't supported. */
function LinkBox({ choices, onOpen }: AddSourceProps) {
    const [link, setLink] = useState("");
    const [note, setNote] = useState<string | null>(null);
    const [looking, startLooking] = useTransition();
    const lookUp = (event: FormEvent) => {
        event.preventDefault();
        startLooking(async () => {
            const found = await recognizeSourceLink(link).catch(() => null);
            const choice = choices.find((each) => each.id === found?.module);
            if (found === null || choice === undefined) return setNote(NOT_SUPPORTED);
            onOpen({ id: null, module: found.module, name: found.name, values: paramValues(choice.fields, found.params) });
        });
    };
    return (
        <form onSubmit={lookUp}>
            <input aria-label="Paste a jobs page link" placeholder="Paste a jobs page link" value={link} onChange={(event) => setLink(event.target.value)} /> <button disabled={looking}>Open</button>
            {note === null ? null : <p className="note">{note}</p>}
        </form>
    );
}

/** Lists each source type with its description, opening an empty form for it, or saying what it needs before it can be used. */
function ChoiceList({ choices, onOpen }: AddSourceProps) {
    return (
        <ul aria-label="Source types">
            {choices.map((choice) => (
                <li key={choice.id}>
                    <button type="button" disabled={choice.unavailable !== null} onClick={() => onOpen({ id: null, module: choice.id, name: "", values: paramValues(choice.fields, {}) })}>
                        {choice.name}
                    </button>{" "}
                    {choice.description}
                    {choice.unavailable === null ? null : <small className="note"> {choice.unavailable}</small>}
                </li>
            ))}
        </ul>
    );
}

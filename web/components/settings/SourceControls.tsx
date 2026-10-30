"use client";

import { useState, useTransition } from "react";
import type { SourceRowView } from "../../../src/web/sourceRows.js";
import { deleteSource, setSourceEnabled, type SwitchResult } from "../../lib/sourceActions.js";

const FAILED = "Couldn't save — try again";

/** Renders a saved source's On switch, saying why when turning it on is refused or the change fails. */
export function SourceSwitch({ row }: { row: SourceRowView }) {
    const [note, setNote] = useState<string | null>(null);
    const [saving, startSaving] = useTransition();
    const toggle = (on: boolean) => startSaving(async () => setNote(switchNote(await setSourceEnabled(row.id, on).catch(() => null))));
    return (
        <label>
            <input type="checkbox" checked={row.on} disabled={saving} onChange={(event) => toggle(event.target.checked)} /> On
            {note === null ? null : <small className="note"> {note}</small>}
        </label>
    );
}

/** Renders a saved source's Delete button, which asks to confirm first and says so if deleting fails. */
export function DeleteSource({ row }: { row: SourceRowView }) {
    const [failed, setFailed] = useState(false);
    const [deleting, startDeleting] = useTransition();
    const remove = () => {
        if (!window.confirm(`Delete the source "${row.name}"? Its jobs stay, labelled with its name.`)) return;
        startDeleting(async () => setFailed((await deleteSource(row.id).catch(() => null))?.ok !== true));
    };
    return (
        <>
            <button type="button" onClick={remove} disabled={deleting}>
                Delete
            </button>
            {failed ? <small className="note">{FAILED}</small> : null}
        </>
    );
}

/** Says what a switch's change came to: nothing once saved, the refusal's reason, or that it failed. */
function switchNote(result: SwitchResult | null): string | null {
    if (result === null) return FAILED;
    return result.ok ? null : result.problem;
}

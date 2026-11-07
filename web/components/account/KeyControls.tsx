"use client";

import { useState } from "react";
import { addKey } from "../../lib/keyBrowser.js";
import { removeKey } from "../../lib/keyActions.js";
import { Field } from "./Field.js";
import { CodesShown } from "./RecoveryCodes.js";
import { shownRefusal, useStepUp } from "./StepUp.js";

/** Renders the account's keys by name, each with a Delete button. */
function KeyList({ keys, onRemove }: { keys: Array<{ id: number; name: string }>; onRemove: (id: number) => void }) {
    if (keys.length === 0) return <p>No keys yet.</p>;
    return (
        <table className="striped" aria-label="Hardware keys">
            <tbody>
                {keys.map((key) => (
                    <tr key={key.id}>
                        <td>{key.name}</td>
                        <td>
                            <button type="button" className="secondary outline" onClick={() => onRemove(key.id)}>
                                Delete
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/** Returns the keys' refusal and new recovery codes, with the handlers that add a key and delete one, asking to confirm it's you when due. */
function useKeyActions() {
    const run = useStepUp();
    const [refusal, setRefusal] = useState<string | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const add = async (form: FormData) => {
        const answer = await run(() => addKey(String(form.get("key-name") ?? "")));
        setRefusal(shownRefusal(answer));
        if (answer.ok && answer.recoveryCodes) setCodes(answer.recoveryCodes);
    };
    const remove = (id: number) => void run(() => removeKey(id)).then((answer) => setRefusal(shownRefusal(answer)));
    return { refusal, codes, clearCodes: () => setCodes(null), add, remove };
}

/** Renders the hardware keys' controls: the keys by name with Delete, and the form that adds one; the first key shows the recovery codes once. */
export function KeyControls({ keys }: { keys: Array<{ id: number; name: string }> }) {
    const { refusal, codes, clearCodes, add, remove } = useKeyActions();
    if (codes !== null) return <CodesShown codes={codes} onSaved={clearCodes} />;
    return (
        <>
            <KeyList keys={keys} onRemove={remove} />
            <form action={add}>
                <Field name="key-name" label="Key name" maxLength={50} required invalid={refusal !== null} note={refusal} />
                <button>Add key</button>
            </form>
        </>
    );
}

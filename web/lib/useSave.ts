import { useState, type FormEvent } from "react";
import { saveOutcome } from "./saveOutcome.js";

export type SaveStatus = "idle" | "saving" | "failed";

/** Sends one change to the server when its form is submitted, tracking whether it is saving or failed and handing on the saved result. */
export function useSave<R extends { ok: boolean }>(send: () => Promise<R>, onSaved: (result: Extract<R, { ok: true }>) => void) {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setStatus("saving");
        const saved = saveOutcome(await send().catch(() => null));
        setStatus(saved === null ? "failed" : "idle");
        if (saved !== null) onSaved(saved);
    };
    return { status, submit };
}

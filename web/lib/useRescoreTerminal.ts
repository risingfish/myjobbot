import { useEffect, useEffectEvent, useState } from "react";
import type { RescoreEnd } from "../../src/db/rescoreLogStore.js";
import type { JobKey } from "../../src/db/store.js";
import type { JobRowView, RescoreStart } from "../../src/web/api.js";
import { rescoreNote } from "../../src/web/rescoreNote.js";
import { jobParam } from "./jobParam.js";
import type { Details } from "./useJobDetails.js";

interface Watch {
    details: Details;
    bump: () => void;
    onRescored: (job: JobRowView, row: JobRowView) => void;
}

interface TerminalState {
    name: string | null;
    run: string | null;
    ended: boolean;
    note: string | null;
    waiting: Details | null;
}

export interface RescoreControls {
    running: boolean;
    note: string | null;
    onStart: (result: RescoreStart) => void;
}

const IDLE: Omit<TerminalState, "name"> = { run: null, ended: false, note: null, waiting: null };

/** Keeps the shown job's re-score terminal: the run it follows, the note the re-score ended with, and the job's reload once it ends; another job, or closing the panel, drops it. */
export function useRescoreTerminal(shown: JobKey | null, watch: Watch) {
    const name = shown === null ? null : jobParam(shown);
    const [state, setState] = useState<TerminalState>({ ...IDLE, name });
    if (state.name !== name) setState({ ...IDLE, name });
    const change = (next: Partial<TerminalState>) => setState((current) => ({ ...current, ...next }));
    useReloaded(watch.details, state.waiting, (row) => {
        change({ waiting: null });
        watch.onRescored(row, row);
    });
    const ended = (end: RescoreEnd) => {
        change({ ended: true, note: rescoreNote(end), waiting: watch.details });
        watch.bump();
    };
    const onStart = (result: RescoreStart) => change("run" in result ? { run: result.run, ended: false, note: null } : { note: rescoreNote(result) });
    const terminal = state.run === null || shown === null ? null : { run: state.run, key: shown };
    const controls: RescoreControls = { running: state.run !== null && !state.ended, note: state.note, onStart };
    return { terminal, controls, ended, close: () => change({ run: null }) };
}

/** Hands on the job's reloaded row once details newer than those shown when the re-score ended arrive. */
function useReloaded(details: Details, waiting: Details | null, onRow: (row: JobRowView) => void): void {
    const reloaded = useEffectEvent(onRow);
    useEffect(() => {
        if (waiting !== null && details !== waiting && details.state === "found") reloaded(details.view.job);
    }, [details, waiting]);
}

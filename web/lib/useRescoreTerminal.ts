import { useEffect, useEffectEvent, useState } from "react";
import type { RescoreEnd } from "../../src/db/rescoreLogStore.js";
import type { JobKey } from "../../src/db/store.js";
import type { JobRowView, RescoreMark, RescoreStart } from "../../src/web/api.js";
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
    live: boolean;
    ended: boolean;
    note: string | null;
    waiting: Details | null;
    checked: boolean;
}

export interface RescoreControls {
    running: boolean;
    note: string | null;
    onStart: (result: RescoreStart) => void;
}

type Change = (next: Partial<TerminalState>) => void;

const IDLE: Omit<TerminalState, "name"> = { run: null, live: false, ended: false, note: null, waiting: null, checked: false };

/** Keeps the shown job's re-score terminal: the run it follows, the note a live re-score ended with, and the job's reload once it ends; another job, or closing the panel, drops it. */
export function useRescoreTerminal(shown: JobKey | null, watch: Watch) {
    const name = shown === null ? null : jobParam(shown);
    const [state, setState] = useState<TerminalState>({ ...IDLE, name });
    const next = adjusted(state, name, watch.details);
    if (next !== null) setState(next);
    const change: Change = (fields) => setState((current) => ({ ...current, ...fields }));
    useReloaded(watch.details, state.waiting, (row) => {
        change({ waiting: null });
        watch.onRescored(row, row);
    });
    const actions = terminalActions(state, change, watch);
    const terminal = state.run === null || shown === null ? null : { run: state.run, key: shown };
    const controls: RescoreControls = { running: state.live && state.run !== null && !state.ended, note: state.note, onStart: actions.onStart };
    return { terminal, controls, ended: actions.ended, openLog: actions.openLog, close: () => change({ run: null }) };
}

/** Gives the state to switch to when another job is shown, or when the shown job's details first arrive with a re-score still running, which then opens; else null. */
function adjusted(state: TerminalState, name: string | null, details: Details): TerminalState | null {
    if (state.name !== name) return { ...IDLE, name };
    if (state.checked || details.state !== "found") return null;
    const running = details.view.history.find((entry) => entry.rescore?.state === "running")?.rescore ?? null;
    return state.run !== null || running === null ? { ...state, checked: true } : { ...state, checked: true, run: running.id, live: true, ended: false };
}

/** Builds what the panel does with its terminal: start following a new run, open a run's saved log, and act on a live run's end. */
function terminalActions(state: TerminalState, change: Change, watch: Watch) {
    const onStart = (result: RescoreStart) => change("run" in result ? { run: result.run, live: true, ended: false, note: null } : { note: rescoreNote(result) });
    const openLog = (mark: RescoreMark) => change({ run: mark.id, live: mark.state === "running", ended: false });
    const ended = (end: RescoreEnd) => {
        if (!state.live) return change({ ended: true });
        change({ ended: true, note: rescoreNote(end), waiting: watch.details });
        watch.bump();
    };
    return { onStart, openLog, ended };
}

/** Hands on the job's reloaded row once details newer than those shown when the re-score ended arrive. */
function useReloaded(details: Details, waiting: Details | null, onRow: (row: JobRowView) => void): void {
    const reloaded = useEffectEvent(onRow);
    useEffect(() => {
        if (waiting !== null && details !== waiting && details.state === "found") reloaded(details.view.job);
    }, [details, waiting]);
}

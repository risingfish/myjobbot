import { useEffect, useRef } from "react";
import type { RescoreEnd } from "../../../src/db/rescoreLogStore.js";
import type { JobKey } from "../../../src/db/store.js";
import { commandLine, consoleLine } from "../../../src/rescore/steps.js";
import { useRescoreLog } from "../../lib/useRescoreLog.js";

interface TerminalProps {
    run: string;
    job: JobKey;
    onEnd: (end: RescoreEnd) => void;
    onClose: () => void;
}

type Log = ReturnType<typeof useRescoreLog>;

/** Shows a re-score's steps as they happen, like a script running in a terminal window; it takes no input. */
export function RescoreTerminal({ run, job, onEnd, onClose }: TerminalProps) {
    const log = useRescoreLog(run, onEnd);
    return (
        <section className="rescore-terminal" data-theme="dark" aria-label="Re-score log">
            <header className="terminal-bar">
                <span>{commandLine(job).slice(2)}</span>
                <button type="button" className="terminal-close" aria-label="Close the re-score log" onClick={onClose}>
                    ×
                </button>
            </header>
            <TerminalBody job={job} log={log} />
        </section>
    );
}

/** Shows the command, then each line with its time, a cursor while the run goes on, and keeps the newest line in view. */
function TerminalBody({ job, log: { lines, end, lost } }: { job: JobKey; log: Log }) {
    const body = useRef<HTMLDivElement>(null);
    useEffect(() => {
        body.current?.scrollTo({ top: body.current.scrollHeight });
    }, [lines.length, lost]);
    return (
        <div className="terminal-body" role="log" aria-live="polite" ref={body}>
            <div>{commandLine(job)}</div>
            {lines.map((line) => (
                <div key={line.seq}>{consoleLine(line.line, line.elapsedMs)}</div>
            ))}
            {lost && <div className="terminal-lost">live view lost: reopen the log from History</div>}
            {end === null && !lost && <span className="terminal-cursor" aria-hidden="true" />}
        </div>
    );
}

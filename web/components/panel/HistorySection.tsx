import type { HistoryEntry, RescoreMark } from "../../../src/web/api.js";
import { PanelSection } from "./PanelSection.js";

type OpenLog = (mark: RescoreMark) => void;

/** Lists every score recorded for the job and every re-score, newest first, with when it happened, its two parts, the run, and a re-score's log. */
export function HistorySection({ history, onOpenLog }: { history: HistoryEntry[]; onOpenLog: OpenLog }) {
    return <PanelSection title="History">{history.length === 0 ? <p>No scores yet.</p> : <HistoryTable history={history} onOpenLog={onOpenLog} />}</PanelSection>;
}

/** Lays the history out as a table, one row per score or re-score. */
function HistoryTable({ history, onOpenLog }: { history: HistoryEntry[]; onOpenLog: OpenLog }) {
    return (
        <table className="details-history">
            <thead>
                <tr>
                    <th scope="col">Scored</th>
                    <th scope="col">Score</th>
                    <th scope="col">Resume + preference</th>
                    <th scope="col">Run</th>
                    <th scope="col" aria-label="Log" />
                </tr>
            </thead>
            <tbody>
                {history.map((entry, index) => (
                    <HistoryRow key={`${index}:${entry.scoredAt}`} entry={entry} onOpenLog={onOpenLog} />
                ))}
            </tbody>
        </table>
    );
}

/** Shows one score, or a re-score that saved none with how it ended, saying "unknown" for parts or a run that weren't recorded. */
function HistoryRow({ entry, onOpenLog }: { entry: HistoryEntry; onOpenLog: OpenLog }) {
    const parts = entry.base === null || entry.bonus === null ? "unknown" : `${entry.base} + ${entry.bonus}`;
    const { rescore } = entry;
    return (
        <tr>
            <td>{entry.scoredAt}</td>
            <td>{entry.total ?? (rescore === null ? "unknown" : outcomeText(rescore))}</td>
            <td>{entry.total === null ? "" : parts}</td>
            <td>{entry.run ?? "unknown"}</td>
            <td>
                {rescore !== null && (
                    <button type="button" className="outline secondary" onClick={() => onOpenLog(rescore)}>
                        Log
                    </button>
                )}
            </td>
        </tr>
    );
}

/** Says how a re-score that saved no score ended, or that it is still running. */
function outcomeText({ state, filter }: RescoreMark): string {
    if (state === "running") return "running…";
    if (state === "filtered") return filter === null ? "filtered" : `filtered: ${filter} filter`;
    return state;
}

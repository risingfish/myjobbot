import type { HistoryEntry } from "../../../src/web/api.js";
import { PanelSection } from "./PanelSection.js";

/** Lists every score recorded for the job, newest first, with when it was given, its two parts and the run that gave it. */
export function HistorySection({ history }: { history: HistoryEntry[] }) {
    return <PanelSection title="History">{history.length === 0 ? <p>No scores yet.</p> : <HistoryTable history={history} />}</PanelSection>;
}

/** Lays the recorded scores out as a table, one row per score. */
function HistoryTable({ history }: { history: HistoryEntry[] }) {
    return (
        <table className="details-history">
            <thead>
                <tr>
                    <th scope="col">Scored</th>
                    <th scope="col">Score</th>
                    <th scope="col">Resume + preference</th>
                    <th scope="col">Run</th>
                </tr>
            </thead>
            <tbody>
                {history.map((entry, index) => (
                    <HistoryRow key={`${index}:${entry.scoredAt}`} entry={entry} />
                ))}
            </tbody>
        </table>
    );
}

/** Shows one recorded score, saying "unknown" for parts or a run that weren't recorded. */
function HistoryRow({ entry }: { entry: HistoryEntry }) {
    const parts = entry.base === null || entry.bonus === null ? "unknown" : `${entry.base} + ${entry.bonus}`;
    return (
        <tr>
            <td>{entry.scoredAt}</td>
            <td>{entry.total}</td>
            <td>{parts}</td>
            <td>{entry.run ?? "unknown"}</td>
        </tr>
    );
}

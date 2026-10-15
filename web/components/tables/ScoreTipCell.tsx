import { useId } from "react";
import type { Score } from "../../../src/web/api.js";

/** Renders a job's score cell: the bare number, or nothing when the job is unscored. */
export function ScoreTipCell({ score }: { score: Score | null }) {
    return <td className="score-col">{score && <ScoreNumber score={score} />}</td>;
}

/** Renders a score whose breakdown note, when it has one, opens on hover or keyboard focus. */
function ScoreNumber({ score }: { score: Score }) {
    const id = useId();
    if (score.note === "") return <span className="score">{score.value}</span>;
    return (
        <span className="score" tabIndex={0} aria-describedby={id}>
            {score.value}
            <span role="tooltip" id={id} className="tip">
                {score.note}
            </span>
        </span>
    );
}

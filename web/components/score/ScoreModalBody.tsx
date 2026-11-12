import type { JobDetailView, ScoreDetail } from "../../../src/web/api.js";
import { scoreRun } from "../../../src/web/scoreRun.js";
import type { Details } from "../../lib/useJobDetails.js";
import { NoteList } from "../panel/NoteList.js";
import { Fact, FactLines } from "../panel/PanelSection.js";

/** Shows the modal's rows once the job's details load, or that they are loading, missing or failed. */
export function ScoreModalBody({ details }: { details: Details }) {
    if (details.state === "loading") return <p>Loading…</p>;
    if (details.state === "failed") return <p role="alert">{`Couldn't load the score: ${details.error}`}</p>;
    if (details.state === "missing" || details.view.score === null) return <p>Not scored yet.</p>;
    return <ScoreRows view={details.view} score={details.view.score} />;
}

/** Lays out the score in rows: its run and time, the score and boosts, then the reasons and the gaps. */
function ScoreRows({ view, score }: { view: JobDetailView; score: ScoreDetail }) {
    return (
        <>
            <p className="score-when">
                Run {scoreRun(view) ?? "unknown"} · scored {score.scoredAt ?? "unknown"}
            </p>
            <dl className="details-facts">
                <Fact label="Score" value={`${score.total} (model ${score.model}${partsText(score)})`} />
                <FactLines label="Boosts" headline={score.boost === null ? "none" : `+${score.boost.total}`} lines={score.boost?.lines ?? []} />
            </dl>
            <NoteList label="Reasons" notes={score.reasons} />
            <NoteList label="Gaps" notes={score.gaps} />
        </>
    );
}

/** Adds the model score's two parts, each out of 50, when both were recorded. */
function partsText(score: ScoreDetail): string {
    return score.base === null || score.bonus === null ? "" : `: resume fit ${score.base} of 50, preference fit ${score.bonus} of 50`;
}

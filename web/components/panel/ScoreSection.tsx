import type { ScoreDetail } from "../../../src/web/api.js";
import { Fact, PanelSection } from "./PanelSection.js";

/** Explains the job's score in the details panel: the total, how it was boosted, its two parts and the notes behind it. */
export function ScoreSection({ score }: { score: ScoreDetail | null }) {
    return (
        <PanelSection title="Score">
            {score === null ? (
                <p>Not scored yet.</p>
            ) : (
                <>
                    <ScoreFacts score={score} />
                    <NoteList label="Reasons" notes={score.reasons} />
                    <NoteList label="Gaps" notes={score.gaps} />
                </>
            )}
        </PanelSection>
    );
}

/** Lists the score's numbers: the total, the model's own score, the boost, both parts and when it was scored. */
function ScoreFacts({ score }: { score: ScoreDetail }) {
    return (
        <dl className="details-facts">
            <Fact label="Score" value={String(score.total)} />
            <Fact label="Model's score" value={String(score.model)} />
            <Fact label="Title boost" value={score.boost ?? "none"} />
            <Fact label="Resume fit" value={partText(score.base)} />
            <Fact label="Preference fit" value={partText(score.bonus)} />
            <Fact label="Scored" value={score.scoredAt ?? "waiting to be scored again"} />
        </dl>
    );
}

/** Shows one part of the score out of its 50 points, or nothing when the part wasn't recorded. */
function partText(part: number | null): string {
    return part === null ? "" : `${part} of 50`;
}

/** Lists the score's reasons or gaps under a small heading, saying "none" when there are none. */
function NoteList({ label, notes }: { label: string; notes: string[] }) {
    return (
        <>
            <h4>{label}</h4>
            {notes.length === 0 ? (
                <p>none</p>
            ) : (
                <ul className="details-notes">
                    {notes.map((note, index) => (
                        <li key={`${index}:${note}`}>{note}</li>
                    ))}
                </ul>
            )}
        </>
    );
}

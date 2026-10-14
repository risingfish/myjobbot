import type { Score } from "../../../src/web/api.js";

/** Renders a table cell with a score and its breakdown note, empty when the job is unscored. */
export function ScoreCell({ score }: { score: Score | null }) {
  if (score === null) return <td />;
  return (
    <td>
      <span className="score">{score.value}</span>
      {score.note !== "" && <><br /><small>{score.note}</small></>}
    </td>
  );
}

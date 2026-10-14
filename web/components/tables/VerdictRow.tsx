import type { VerdictRowView } from "../../../src/web/api.js";
import { BulletList } from "../common/BulletList.js";
import { ExternalLink } from "../common/ExternalLink.js";
import { ScoreCell } from "./ScoreCell.js";

/** Renders one scoring decision as a row of the reasoning history. */
export function VerdictRow({ verdict }: { verdict: VerdictRowView }) {
  return (
    <tr className="verdict">
      <td>{verdict.scoredAt}</td>
      <td>{verdict.run ?? <small>before history</small>}</td>
      <td><ExternalLink url={verdict.url}>{verdict.title}</ExternalLink></td>
      <td>{verdict.company}</td>
      <ScoreCell score={verdict.score} />
      <ReasonCells verdict={verdict} />
    </tr>
  );
}

/** Renders the cells listing why the model gave a score: its reasons and the gaps it saw. */
function ReasonCells({ verdict }: { verdict: VerdictRowView }) {
  return <><td><BulletList items={verdict.reasons} /></td><td><BulletList items={verdict.gaps} /></td></>;
}

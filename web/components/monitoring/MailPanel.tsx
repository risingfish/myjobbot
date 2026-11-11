import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { CountTable } from "./CountTable.js";
import { SectionGrid } from "./SectionGrid.js";

const NOTHING = "Nothing in this period";

/** Renders the mail sent by kind and outcome and its failures by fixed reason, filling the columns from the left, never an address. */
export function MailPanel({ mail }: { mail: { sends: CountRow[]; failures: CountRow[] } }) {
    return (
        <Panel title="Mail">
            <SectionGrid empty={NOTHING} items={[mail.sends.length === 0 ? null : <CountTable key="sends" label="Mail sent" heading="Kind and outcome" rows={mail.sends} />, mail.failures.length === 0 ? null : <CountTable key="failures" label="Mail failures" heading="Reason" rows={mail.failures} />]} />
        </Panel>
    );
}

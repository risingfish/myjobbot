import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { CountTable } from "./CountTable.js";

const NOTHING = "Nothing in this period";

/** Renders the mail sent by kind and outcome beside its failures by fixed reason, never an address. */
export function MailPanel({ mail }: { mail: { sends: CountRow[]; failures: CountRow[] } }) {
    return (
        <Panel title="Mail">
            {mail.sends.length === 0 ? (
                <p className="note">{NOTHING}</p>
            ) : (
                <div className="grid">
                    <CountTable label="Mail sent" heading="Kind and outcome" rows={mail.sends} />
                    {mail.failures.length === 0 ? <div /> : <CountTable label="Mail failures" heading="Reason" rows={mail.failures} />}
                </div>
            )}
        </Panel>
    );
}

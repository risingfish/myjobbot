import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { countCard } from "./CountTable.js";
import { SectionGrid } from "./SectionGrid.js";

const SUMMARY = "Sign-in links, codes and security notices sent, by kind. A failure shows only its fixed reason, never an address.";

const NOTHING = "Nothing in this period";

/** Renders the mail sent by kind and outcome and its failures by fixed reason, each in its card, filling the columns from the left, never an address. */
export function MailPanel({ mail }: { mail: { sends: CountRow[]; failures: CountRow[] } }) {
    const cards = [countCard({ title: "Mail sent", label: "Mail sent", heading: "Kind and outcome", rows: mail.sends }), countCard({ title: "Mail failures", label: "Mail failures", heading: "Reason", rows: mail.failures })];
    return (
        <Panel title="Mail">
            <p>{SUMMARY}</p>
            <SectionGrid empty={NOTHING} items={cards} />
        </Panel>
    );
}

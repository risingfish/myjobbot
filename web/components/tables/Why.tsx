import { BulletList } from "../common/BulletList.js";

/** Renders the collapsible reasons and gaps behind a job's score, or nothing when there are none. */
export function Why({ reasons, gaps }: { reasons: string[]; gaps: string[] }) {
    if (reasons.length + gaps.length === 0) return null;
    return (
        <details>
            <summary>Why</summary>
            <Labelled label="Reasons" items={reasons} />
            <Labelled label="Gaps" items={gaps} />
        </details>
    );
}

/** Renders a labelled bullet list, or nothing when the list is empty. */
function Labelled({ label, items }: { label: string; items: string[] }) {
    if (items.length === 0) return null;
    return (
        <>
            <strong>{label}</strong>
            <BulletList items={items} />
        </>
    );
}

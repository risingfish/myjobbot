import type { ReactNode } from "react";

/** Renders a section's datasets in two columns, filled from the left, with the right one left empty when there is only one; with none, the section's empty line. */
export function SectionGrid({ items, empty }: { items: ReactNode[]; empty: string }) {
    const present = items.filter((item) => item !== null && item !== undefined && item !== false);
    if (present.length === 0) return <p className="note">{empty}</p>;
    return (
        <div className="grid">
            {present}
            {present.length === 1 ? <div /> : null}
        </div>
    );
}

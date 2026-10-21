import type { ReactNode } from "react";

/** Renders one named section of the job details panel. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="details-section">
            <h3>{title}</h3>
            {children}
        </section>
    );
}

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

/** Shows one labelled fact, saying "unknown" when it is missing. */
export function Fact({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{value === "" ? "unknown" : value}</dd>
        </>
    );
}

/** Shows one labelled fact made of a headline and a line per item under it, such as a boost's total and each term that earned it. */
export function FactLines({ label, headline, lines }: { label: string; headline: string; lines: string[] }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>
                {headline}
                {lines.length > 0 && (
                    <ul className="details-notes">
                        {lines.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                )}
            </dd>
        </>
    );
}

import { PanelSection } from "./PanelSection.js";

/** Lists what the owner should know before trusting the job's details, and shows nothing when there is nothing to warn about. */
export function WarningsSection({ warnings }: { warnings: string[] }) {
    if (warnings.length === 0) return null;
    return (
        <PanelSection title="Warnings">
            {warnings.map((warning) => (
                <p key={warning} className="details-warning">
                    {warning}
                </p>
            ))}
        </PanelSection>
    );
}

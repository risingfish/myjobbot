import type { Period } from "../../../src/monitoring/periods.js";

const CHOICES: Array<{ period: Period; label: string }> = [
    { period: "day", label: "Last day" },
    { period: "week", label: "Last 7 days" },
    { period: "month", label: "Last 30 days" },
];

/** Renders the links that choose the Monitoring page's period, marking the one shown. */
export function PeriodChoice({ period }: { period: Period }) {
    return (
        <nav aria-label="Period">
            <ul>
                {CHOICES.map((choice) => (
                    <li key={choice.period}>
                        <a href={`/monitoring?period=${choice.period}`} aria-current={choice.period === period ? "page" : undefined}>
                            {choice.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

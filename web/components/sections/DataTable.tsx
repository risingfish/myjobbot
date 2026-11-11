import type { ReactNode } from "react";

interface DataTableProps {
    label: string;
    headings: string[];
    rows: Array<{ key: string; cells: ReactNode[] }>;
}

/** Renders a table's heading row. */
function Headings({ headings }: { headings: string[] }) {
    return (
        <thead>
            <tr>
                {headings.map((heading) => (
                    <th key={heading}>{heading}</th>
                ))}
            </tr>
        </thead>
    );
}

/** Renders a labelled table that scrolls on its own at phone width, one row of cells per item. */
export function DataTable({ label, headings, rows }: DataTableProps) {
    return (
        <div className="overflow-auto">
            <table className="striped" aria-label={label}>
                <Headings headings={headings} />
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key}>
                            {row.cells.map((cell, index) => (
                                <td key={headings[index]}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

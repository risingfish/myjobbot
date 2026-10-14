import type { ReactNode } from "react";

interface DataTableProps {
    headers: readonly string[];
    children: ReactNode;
    more?: (columns: number) => ReactNode;
}

/** Renders a scrollable table with the given column headers around its rows, plus an optional last row. */
export function DataTable({ headers, children, more }: DataTableProps) {
    return (
        <div className="table">
            <table>
                <thead>
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index}>{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {children}
                    {more?.(headers.length)}
                </tbody>
            </table>
        </div>
    );
}

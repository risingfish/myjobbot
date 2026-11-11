"use client";

import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from "chart.js";
import { useEffect, useRef } from "react";
import type { ChartSeries } from "../../../src/web/chartSeries.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const GOOD = new Set(["ok", "finished"]);
const BAD = new Set(["failing", "failed", "never finished"]);

/** Picks a Pico colour for a series by what it counts: good outcomes green, bad ones red, the rest the primary colour. */
function colourFor(name: string, styles: CSSStyleDeclaration): string {
    const variable = GOOD.has(name) ? "--pico-ins-color" : BAD.has(name) ? "--pico-del-color" : "--pico-primary";
    return styles.getPropertyValue(variable).trim() || "gray";
}

/** Draws one stacked bar chart with Chart.js, rebuilding it when its numbers change. */
function useBarChart(series: ChartSeries) {
    const canvas = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (canvas.current === null) return undefined;
        const styles = getComputedStyle(document.documentElement);
        const datasets = series.sets.map((set) => ({ label: set.name, data: set.values, backgroundColor: colourFor(set.name, styles) }));
        const chart = new Chart(canvas.current, { type: "bar", data: { labels: series.labels, datasets }, options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
        return () => chart.destroy();
    }, [series]);
    return canvas;
}

/** Renders a chart's numbers as a table: a column per series, a row per day. */
function ChartTable({ label, series }: { label: string; series: ChartSeries }) {
    return (
        <table aria-label={label}>
            <thead>
                <tr>
                    <th>Day</th>
                    {series.sets.map((set) => (
                        <th key={set.name}>{set.name}</th>
                    ))}
                </tr>
            </thead>
            <ChartRows series={series} />
        </table>
    );
}

/** Renders one table row per day of a chart, with each series' count that day. */
function ChartRows({ series }: { series: ChartSeries }) {
    return (
        <tbody>
            {series.labels.map((day, index) => (
                <tr key={day}>
                    <td>{day}</td>
                    {series.sets.map((set) => (
                        <td key={set.name}>{set.values[index]}</td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
}

/** Renders a bar chart of counts per day on a labelled canvas, with the same numbers in a table beneath it. */
export function MonitoringChart({ label, series }: { label: string; series: ChartSeries }) {
    const canvas = useBarChart(series);
    return (
        <figure>
            <canvas ref={canvas} role="img" aria-label={label} />
            <details>
                <summary>{label}, as numbers</summary>
                <div className="overflow-auto">
                    <ChartTable label={label} series={series} />
                </div>
            </details>
        </figure>
    );
}

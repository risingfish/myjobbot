import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { MonitoringChart } from "../../web/components/monitoring/MonitoringChart.js";
import { RunsPanel } from "../../web/components/monitoring/RunsPanel.js";

const ROW = { id: "run-1", started: "2026-11-10 01:00", duration: "4m 12s", status: "never finished", users: 2, fetches: "5 (1 failing)", jobs: "12 found, 9 scored", modelCalls: 14, incomplete: true };
const SERIES = { labels: ["2026-11-09", "2026-11-10"], sets: [{ name: "finished", values: [2, 1] }, { name: "failed", values: [0, 1] }] };

test("the runs panel lists each run with a link to its detail and the period choice, and says when there are none", () => {
    const { unmount } = render(<RunsPanel period="week" rows={[ROW]} chart={SERIES} />);
    const table = screen.getByRole("table", { name: "Runs" });
    expect(within(table).getByRole("link", { name: "2026-11-10 01:00" }).getAttribute("href")).toBe("/monitoring?period=week&run=run-1");
    expect(within(table).getByText(/never finished/).textContent).toContain("record incomplete");
    expect(screen.getByRole("link", { name: "Last 30 days" }).getAttribute("href")).toBe("/monitoring?period=month");
    expect(screen.getByRole("link", { name: "Last 7 days" }).getAttribute("aria-current")).toBe("page");
    unmount();
    render(<RunsPanel period="day" rows={[]} chart={{ labels: [], sets: [] }} />);
    expect([screen.getByText("No runs yet").tagName, screen.queryByRole("table")]).toEqual(["P", null]);
});

test("a chart draws on a labelled canvas and gives its numbers as a table too", () => {
    render(<MonitoringChart label="Runs per day" series={SERIES} />);
    expect(screen.getByRole("img", { name: "Runs per day" }).tagName).toBe("CANVAS");
    const table = screen.getByRole("table", { name: "Runs per day" });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["Dayfinishedfailed", "2026-11-0920", "2026-11-1011"]);
});

import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { jobPage, jobRowView, verdictPage, verdictRowView } from "../helpers/rowFixtures.js";

vi.mock("../../web/lib/actions.js", () => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn() }));

const JOB_HEADERS = ["Score", "Title", "Company", "Location", "Remote", "Source", "Posted", "Scored", ""];
const VERDICT_HEADERS = ["Scored at", "Run", "Job", "Company", "Score", "Reasons", "Gaps"];

function headers(container: HTMLElement): string[] {
    return [...container.querySelectorAll("th")].map((cell) => cell.textContent ?? "");
}

test("a page of jobs shows its summary and a table of rows", () => {
    const { container } = render(<RowsList name="jobs" initial={jobPage([jobRowView()], { summary: "1 jobs" })} />);
    expect(screen.getByText("1 jobs")).toBeTruthy();
    expect(headers(container)).toEqual(JOB_HEADERS);
    expect(container.querySelectorAll("tr.job")).toHaveLength(1);
});

test("the reasoning page shows verdict columns", () => {
    const { container } = render(<RowsList name="reasoning" initial={verdictPage([verdictRowView()])} />);
    expect(screen.getByText("1 scoring decisions")).toBeTruthy();
    expect(headers(container)).toEqual(VERDICT_HEADERS);
    expect(container.querySelectorAll("tr.verdict")).toHaveLength(1);
});

test("an empty page says so and shows no table", () => {
    const empty = jobPage([], { summary: "0 recommended · threshold 70", empty: "No recommendations yet: run myjobbot run." });
    const { container } = render(<RowsList name="recommended" initial={empty} />);
    expect(screen.getByText("No recommendations yet: run myjobbot run.")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
});

test("the server-rendered rows tell readers without JavaScript what needs it", () => {
    const html = renderToString(<RowsList name="jobs" initial={jobPage([jobRowView()])} />);
    expect(html).toContain('<noscript><p class="note">Loading more rows and Hide need JavaScript.</p></noscript>');
    expect(html).toContain('class="job"');
});

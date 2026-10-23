import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { JobRowView } from "../../src/web/api.js";
import { JobRow } from "../../web/components/tables/JobRow.js";
import { jobRowView } from "../helpers/rowFixtures.js";

vi.mock("../../web/lib/actions.js", () => ({ setJobApplied: vi.fn() }));

function renderRow(overrides: Partial<JobRowView> = {}) {
    return render(
        <table>
            <tbody>
                <JobRow job={jobRowView(overrides)} onApplied={() => {}} />
            </tbody>
        </table>,
    );
}

test("job text from the outside world is shown as text, never run", () => {
    const { container } = renderRow({ title: "<script>alert(1)</script>" });
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
});

test("the title links to the job's details panel in this page, even when the posting has no address", () => {
    renderRow();
    const link = screen.getByRole("link", { name: "Software Engineer a" });
    expect([link.getAttribute("href"), link.getAttribute("target")]).toEqual(["?job=greenhouse%3Aa", null]);
    renderRow({ jobId: "b", title: "Software Engineer b", url: null });
    expect(screen.getByRole("link", { name: "Software Engineer b" }).getAttribute("href")).toBe("?job=greenhouse%3Ab");
    renderRow({ jobId: "c", title: "A very long title", shortTitle: "A very…" });
    expect(screen.getByRole("link", { name: "A very…" }).getAttribute("title")).toBe("A very long title");
});

test("the score cell shows only the number, with its note in a tooltip that keyboard focus can reach", () => {
    const { container } = renderRow({ score: { value: 75, note: "model 65 · +10 typescript" } });
    const score = container.querySelector(".score");
    expect(score?.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tooltip").textContent).toBe("model 65 · +10 typescript");
    expect(score?.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
    expect(container.querySelector("td.score-col")?.textContent).toBe("75model 65 · +10 typescript");
});

test("a score without a note has no tooltip, and an unscored job has an empty score cell", () => {
    const { container } = renderRow({ score: { value: 90, note: "" } });
    expect(container.querySelector(".score")?.getAttribute("tabindex")).toBeNull();
    expect(container.querySelector("[role=tooltip]")).toBeNull();
    const unscored = renderRow({ jobId: "u", score: null });
    expect(unscored.container.querySelector("td.score-col")?.textContent).toBe("");
});

test("the row shows the publisher, days open and a possible-ghost warning", () => {
    renderRow({ via: "LinkedIn", posted: { date: "2026-06-01", daysOpen: 124, ghost: true } });
    expect(screen.getByText("via LinkedIn")).toBeTruthy();
    expect(screen.getByText("124 days open")).toBeTruthy();
    expect(screen.getByText("⚠ possible ghost")).toBeTruthy();
});

test("filter notes and the hidden marker are shown", () => {
    const { container } = renderRow({ filterNote: "hidden by title filter", hidden: true });
    expect(screen.getByText("hidden by title filter")).toBeTruthy();
    expect(container.querySelector("tr")?.dataset.hidden).toBe("1");
    expect(screen.getByText("hidden by you")).toBeTruthy();
});

test("reasons and gaps sit under Why, which is absent when there are none", () => {
    const { container } = renderRow();
    expect(container.querySelector("details summary")?.textContent).toBe("Why");
    expect([...container.querySelectorAll("details li")].map((item) => item.textContent)).toEqual(["reason a", "gap a"]);
    const bare = renderRow({ jobId: "c", reasons: [], gaps: [] });
    expect(bare.container.querySelector("details")).toBeNull();
});

test("a row whose text tried to escape the data markers carries a warning, and other rows don't", () => {
    renderRow({ injection: true });
    expect(screen.getByText("⚠ tried to escape the data markers")).toBeTruthy();
    renderRow({ jobId: "b", title: "Software Engineer b", injection: false });
    expect(screen.getAllByText("⚠ tried to escape the data markers")).toHaveLength(1);
});

import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import type { JobRowView } from "../../src/web/api.js";
import { JobRow } from "../../web/components/tables/JobRow.js";
import { jobRowView } from "../helpers/rowFixtures.js";

function renderRow(overrides: Partial<JobRowView> = {}) {
    return render(
        <table>
            <tbody>
                <JobRow job={jobRowView(overrides)} />
            </tbody>
        </table>,
    );
}

test("job text from the outside world is shown as text, never run", () => {
    const { container } = renderRow({ title: "<script>alert(1)</script>" });
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
});

test("a posting link opens in a new tab, and a missing link leaves plain text", () => {
    renderRow();
    const link = screen.getByRole("link", { name: "Software Engineer a" });
    expect([link.getAttribute("href"), link.getAttribute("target"), link.getAttribute("rel")]).toEqual(["https://example.com/a", "_blank", "noopener noreferrer"]);
    renderRow({ jobId: "b", title: "Software Engineer b", url: null });
    expect(screen.queryByRole("link", { name: "Software Engineer b" })).toBeNull();
    expect(screen.getByText("Software Engineer b")).toBeTruthy();
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

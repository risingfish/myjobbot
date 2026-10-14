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
});

test("the score cell shows the boosted score and its note, and is empty when unscored", () => {
    const { container } = renderRow({ score: { value: 75, note: "model 65 · +10 typescript" } });
    expect(container.querySelector(".score")?.textContent).toBe("75");
    expect(screen.getByText("model 65 · +10 typescript")).toBeTruthy();
    const unscored = renderRow({ score: null });
    expect(unscored.container.querySelector(".score")).toBeNull();
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

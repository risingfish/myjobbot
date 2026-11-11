import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { SourceHistory } from "../../web/components/settings/SourceHistory.js";

test("a source's recent fetches are listed with when, how they went and how many jobs, and a source that keeps failing says so", () => {
    const history = [{ when: "2026-11-10 01:00", outcome: "failing: not found", jobs: 0 }, { when: "2026-11-09 17:00", outcome: "ok", jobs: 4 }];
    render(<SourceHistory history={history} failing />);
    expect(screen.getByText("Failing repeatedly")).toBeTruthy();
    const table = screen.getByRole("table", { name: "Recent fetches" });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["WhenOutcomeJobs", "2026-11-10 01:00failing: not found0", "2026-11-09 17:00ok4"]);
});

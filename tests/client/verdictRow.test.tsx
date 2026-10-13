import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import type { VerdictRowView } from "../../src/web/api.js";
import { VerdictRow } from "../../src/web/client/components/tables/VerdictRow.js";
import { verdictRowView } from "../helpers/rowFixtures.js";

function renderRow(overrides: Partial<VerdictRowView> = {}) {
  return render(<table><tbody><VerdictRow verdict={verdictRowView(overrides)} /></tbody></table>);
}

test("a verdict row shows when it was scored, its run, and its reasons and gaps", () => {
  const { container } = renderRow({ score: { value: 62, note: "base 32 + bonus 30" } });
  expect(screen.getByText("2026-10-02 00:00")).toBeTruthy();
  expect(screen.getByText("run-1")).toBeTruthy();
  expect(screen.getByText("base 32 + bonus 30")).toBeTruthy();
  expect([...container.querySelectorAll("li")].map((item) => item.textContent)).toEqual(["reason a", "gap a"]);
});

test("verdicts from before history was kept are labelled, and pruned jobs are plain text", () => {
  renderRow({ run: null, title: "(pruned)", url: null });
  expect(screen.getByText("before history")).toBeTruthy();
  expect(screen.getByText("(pruned)")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

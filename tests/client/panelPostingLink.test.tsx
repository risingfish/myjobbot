import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PanelHeader } from "../../web/components/panel/PanelHeader.js";
import { jobRowView } from "../helpers/rowFixtures.js";

vi.mock("../../web/lib/actions.js", () => ({ setJobApplied: vi.fn(), setJobHidden: vi.fn() }));

function showHeader(url: string | null) {
    const job = jobRowView({ url });
    return render(<PanelHeader job={job} details={{ state: "loading" }} titleId="t" onApplied={vi.fn()} onHidden={vi.fn()} onClose={vi.fn()} />);
}

test("the panel's posting link opens the posting in a new tab, just after the title and outside its heading", () => {
    const { container } = showHeader("https://example.com/a");
    const heading = container.querySelector("h2");
    const link = heading?.nextElementSibling;
    expect([link?.getAttribute("aria-label"), link?.getAttribute("href"), link?.getAttribute("target"), link?.getAttribute("rel")]).toEqual(["Open the posting", "https://example.com/a", "_blank", "noopener noreferrer"]);
    expect(heading?.textContent).toBe(jobRowView().title);
});

test("the panel shows no posting link for a job without a safe address", () => {
    const { container } = showHeader(null);
    expect(container.querySelector('a[aria-label="Open the posting"]')).toBeNull();
});

import { within } from "@testing-library/dom";
import { beforeEach, expect, test, vi } from "vitest";
import { details, listedDetails, openTitle, panel, section, showPage } from "../helpers/panelPage.js";
import { jobRowView } from "../helpers/rowFixtures.js";

const actions = vi.hoisted(() => ({ loadMoreRows: vi.fn(), setJobHidden: vi.fn(), loadJobDetails: vi.fn() }));

vi.mock("../../web/lib/actions.js", () => actions);
vi.mock("next/navigation.js", () => import("../helpers/navigation.js"));

const SCORE = { total: 75, model: 70, boost: "+5 backend", base: 40, bonus: 30, reasons: ["Strong Go", "<script>alert(1)</script>"], gaps: ["No Kafka"], scoredAt: "2026-10-02 09:30" };

beforeEach(() => {
    actions.loadJobDetails.mockReset().mockImplementation(listedDetails);
});

test("the score section explains the score: total, the model's score, the boost, both parts, reasons and gaps", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, { score: SCORE }));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Score").textContent).toContain("75"));
    for (const text of ["70", "+5 backend", "Resume fit40 of 50", "Preference fit30 of 50", "2026-10-02 09:30", "Strong Go", "No Kafka"]) expect(section("Score").textContent).toContain(text);
    expect([section("Score").querySelector("script"), within(section("Score")).getByText("<script>alert(1)</script>")]).toEqual([null, expect.anything()]);
});

test("an unscored job's panel says it hasn't been scored yet", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Score").textContent).toContain("Not scored yet."));
});

const CAREERS = { text: "Build APIs.\n<script>alert(1)</script>\n## x\n**y**\n- z", format: "text" as const, requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferredSkills: ["Kafka"], origin: { kind: "careers" as const, url: "https://acme.example/jobs/a" } };

test("a careers description shows its text, requirements and skills, and links the page it came from", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, { description: CAREERS }));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Description").textContent).toContain("Build APIs."));
    for (const text of ["5 years of Go", "Go, SQL", "Kafka", "From the careers page"]) expect(section("Description").textContent).toContain(text);
    expect(within(section("Description")).getByRole("link", { name: "the careers page" }).getAttribute("href")).toBe("https://acme.example/jobs/a");
    expect(section("Description").querySelector("script")).toBeNull();
    expect(["h4", "strong", "li"].map((tag) => section("Description").querySelector(tag))).toEqual([null, null, null]);
    expect(section("Description").textContent).toContain("## x\n**y**\n- z");
});

const MARKDOWN = "## Role\n\n- Build **APIs**\n- Ship *often*\n\n[Apply here](https://acme.example/apply)";
const HOSTILE = '<script>alert(1)</script>\n\n<form action="https://x.example"><input name="q"></form>\n\n<iframe src="https://x.example"></iframe>\n\n![x](https://t.example/p.png) [a](javascript:alert(1)) [b](data:text/html,x) <javascript:alert(1)>';

function markdownDescription(text: string) {
    return { description: { text, format: "markdown" as const, requirements: [], skills: [], preferredSkills: [], origin: null } };
}

test("a Markdown description shows as formatting, below the panel's headings, with links opening in a new tab", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, markdownDescription(MARKDOWN)));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(within(section("Description")).getByRole("heading", { level: 4, name: "Role" })).toBeTruthy());
    const shown = section("Description");
    expect([shown.querySelectorAll("li").length, shown.querySelector("strong")?.textContent, shown.querySelector("em")?.textContent]).toEqual([2, "APIs", "often"]);
    expect(shown.textContent).not.toMatch(/##|\*\*/);
    const link = within(shown).getByRole("link", { name: "Apply here" });
    expect(["href", "target", "rel", "referrerpolicy"].map((name) => link.getAttribute(name))).toEqual(["https://acme.example/apply", "_blank", "noopener noreferrer", "no-referrer"]);
});

test("hostile Markdown renders no script, form, frame or image, and no link with an unsafe address", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, markdownDescription(HOSTILE)));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Description").textContent).toContain("a"));
    const shown = section("Description");
    expect(["script", "form", "input", "iframe", "img"].map((tag) => shown.querySelector(tag))).toEqual([null, null, null, null, null]);
    expect(shown.querySelectorAll("a")).toHaveLength(0);
});

test("a job without a description says no description was found", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Description").textContent).toContain("No description found."));
});

const WARNING = "On 2026-10-20 13:05, text from this job's pages tried to escape the data markers that keep it apart from the model's instructions. It was removed before the model read it.";
const HISTORY = [
    { scoredAt: "2026-10-21 08:15", total: 65, base: 40, bonus: 25, run: "0f29a1a3" },
    { scoredAt: "2026-10-19 07:00", total: 50, base: null, bonus: null, run: null },
];

test("a flagged job shows its warning, and the score history lists every score newest first", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, { warnings: [WARNING], history: HISTORY }));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Warnings").textContent).toContain(WARNING));
    const rows = within(section("History")).getAllByRole("row").slice(1);
    expect(rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent))).toEqual([
        ["2026-10-21 08:15", "65", "40 + 25", "0f29a1a3"],
        ["2026-10-19 07:00", "50", "unknown", "unknown"],
    ]);
});

test("a job without warnings has no Warnings section, and one never scored says it has no history", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("History").textContent).toContain("No scores yet."));
    expect(within(panel() as HTMLElement).queryByRole("heading", { level: 3, name: "Warnings" })).toBeNull();
});

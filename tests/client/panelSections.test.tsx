import { within } from "@testing-library/dom";
import { beforeEach, expect, test, vi } from "vitest";
import { details, listedDetails, openTitle, section, showPage } from "../helpers/panelPage.js";
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

const CAREERS = { text: "Build APIs.\n<script>alert(1)</script>", requirements: ["5 years of Go"], skills: ["Go", "SQL"], preferredSkills: ["Kafka"], origin: { kind: "careers" as const, url: "https://acme.example/jobs/a" } };

test("a careers description shows its text, requirements and skills, and links the page it came from", async () => {
    actions.loadJobDetails.mockResolvedValue(details(jobRowView(), {}, { description: CAREERS }));
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Description").textContent).toContain("Build APIs."));
    for (const text of ["5 years of Go", "Go, SQL", "Kafka", "From the careers page"]) expect(section("Description").textContent).toContain(text);
    expect(within(section("Description")).getByRole("link", { name: "the careers page" }).getAttribute("href")).toBe("https://acme.example/jobs/a");
    expect(section("Description").querySelector("script")).toBeNull();
});

test("a job without a description says no description was found", async () => {
    showPage();
    await openTitle("Software Engineer a");
    await vi.waitFor(() => expect(section("Description").textContent).toContain("No description found."));
});

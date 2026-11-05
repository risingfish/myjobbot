import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { editedField } from "../../src/web/settingsForm.js";
import { PreferencesDraft } from "../../web/components/settings/PreferencesDraft.js";
import { PreferencesSection } from "../../web/components/settings/PreferencesSection.js";
import { ResumeSection } from "../../web/components/settings/ResumeSection.js";

const actions = vi.hoisted(() => ({ uploadResume: vi.fn(), extractResumeProfile: vi.fn(), saveResumeProfile: vi.fn() }));
const settings = vi.hoisted(() => ({ saveSettingsSection: vi.fn() }));

vi.mock("../../web/lib/resumeActions.js", () => actions);
vi.mock("../../web/lib/settingsActions.js", () => settings);

beforeEach(() => {
    for (const mock of [actions.uploadResume, actions.extractResumeProfile, actions.saveResumeProfile, settings.saveSettingsSection]) mock.mockReset();
});

const STORED = { text: "# Ada <script>alert(1)</script>", fileName: "ada.md", fileType: "md" as const, uploadedAt: "2026-11-05T10:00:00.000Z", contentId: "0123456789abcdef" };

test("the Resume section shows the resume in use as text, uploads a new one, and keeps it when a file is refused", async () => {
    const { container, rerender } = render(<ResumeSection shown={{ kind: "none" }} profile={null} />);
    expect(screen.getByText("No resume yet")).toBeTruthy();
    rerender(<ResumeSection shown={{ kind: "file", text: "# From the data folder" }} profile={null} />);
    expect([screen.getByText("Using data/resume.md").tagName, container.querySelector("pre")?.textContent]).toEqual(["P", "# From the data folder"]);
    actions.uploadResume.mockResolvedValueOnce({ ok: true, resume: STORED });
    await userEvent.upload(screen.getByLabelText("Resume file"), new File(["# Ada"], "ada.md"));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText(/ada\.md · uploaded 2026-11-05/)).toBeTruthy();
    expect([container.querySelector("pre")?.textContent, container.querySelector("script")]).toEqual([STORED.text, null]);
    actions.uploadResume.mockResolvedValueOnce({ ok: false, error: "No text could be read from that file" });
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No text could be read from that file");
    expect(container.querySelector("pre")?.textContent).toBe(STORED.text);
    const big = new File(["x"], "big.md");
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    await userEvent.upload(screen.getByLabelText("Resume file"), big);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect([screen.getByRole("alert").textContent, actions.uploadResume.mock.calls.length]).toEqual(["That file is over 5 MB", 2]);
});

const PROFILE = {
    summary: "I want senior backend roles",
    skills: [
        { name: "TypeScript", group: "engineering" as const },
        { name: "Mentoring", group: "people" as const },
        { name: "Roadmaps", group: "project" as const },
    ],
    resumeId: "fedcba9876543210",
    extractedAt: "2026-11-05T10:05:00.000Z",
    editedAt: null as string | null,
};

function renderSettings(profile: typeof PROFILE) {
    return render(
        <PreferencesDraft initial={editedField("My own words")}>
            <PreferencesSection />
            <ResumeSection shown={{ kind: "stored", resume: STORED }} profile={profile} />
        </PreferencesDraft>,
    ).container;
}

test("the profile shows its summary and a cloud per group, a moved skill is saved, and a failed save says so", async () => {
    const container = renderSettings(PROFILE);
    expect([(screen.getByLabelText("Profile summary") as HTMLTextAreaElement).value, screen.getByText("From an earlier resume").tagName]).toEqual([PROFILE.summary, "P"]);
    expect([...container.querySelectorAll("ul.tags")].map((cloud) => cloud.getAttribute("aria-label"))).toEqual(["Engineering skills", "People skills", "Project skills"]);
    const moved = [PROFILE.skills[0], { name: "Mentoring", group: "project" }, PROFILE.skills[2]];
    actions.saveResumeProfile.mockResolvedValueOnce({ ok: true, profile: { ...PROFILE, skills: moved, editedAt: "2026-11-05T11:00:00.000Z" } });
    await userEvent.click(screen.getByRole("button", { name: "Move Mentoring to Project" }));
    expect(actions.saveResumeProfile).toHaveBeenLastCalledWith({ summary: PROFILE.summary, skills: moved });
    expect(await screen.findByRole("list", { name: "People skills" }).catch(() => null)).toBeNull();
    actions.saveResumeProfile.mockRejectedValueOnce(new Error("offline"));
    await userEvent.click(screen.getByRole("button", { name: "Remove TypeScript" }));
    expect((await screen.findByText("Couldn't save — try again")).tagName).toBe("SMALL");
});

test("extracting again asks first once the profile is edited, and the summary goes into Preferences without being saved", async () => {
    renderSettings({ ...PROFILE, resumeId: STORED.contentId, editedAt: "2026-11-05T11:00:00.000Z" });
    expect(screen.queryByText("From an earlier resume")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Extract again" }));
    expect([screen.getByRole("dialog").hasAttribute("open"), actions.extractResumeProfile.mock.calls.length]).toEqual([true, 0]);
    actions.extractResumeProfile.mockResolvedValueOnce({ ok: true, profile: { ...PROFILE, summary: "Fresh summary", resumeId: STORED.contentId, extractedAt: "2026-11-05T12:00:00.000Z", editedAt: null } });
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(await screen.findByDisplayValue("Fresh summary")).toBeTruthy();
    Element.prototype.scrollIntoView = () => {};
    await userEvent.click(screen.getByRole("button", { name: "Use summary in Preferences" }));
    expect([(screen.getByLabelText("Preferences") as HTMLTextAreaElement).value, settings.saveSettingsSection.mock.calls.length, actions.saveResumeProfile.mock.calls.length]).toEqual(["Fresh summary", 0, 0]);
});

import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { JobDetailView, JobRowView, PageName } from "../../src/web/api.js";
import { RowsList } from "../../web/components/pages/RowsList.js";
import { jobPage, jobRowView } from "./rowFixtures.js";

export const ROWS = [jobRowView(), jobRowView({ jobId: "b", title: "Backend Engineer b", company: "Beta" })];
let listed: JobRowView[] = ROWS;

export function details(row: JobRowView, terms: Partial<JobDetailView["job"]> = {}, extra: Partial<Omit<JobDetailView, "job">> = {}): JobDetailView {
    return { job: { ...row, pay: null, workplace: null, ...terms }, score: null, description: { text: null, requirements: [], skills: [], preferredSkills: [], origin: null }, ...extra };
}

export async function listedDetails(ats: string, jobId: string): Promise<JobDetailView | null> {
    const row = listed.find((job) => job.ats === ats && job.jobId === jobId);
    return row === undefined ? null : details(row);
}

export function deferred() {
    let resolve: (view: JobDetailView | null) => void = () => {};
    const promise = new Promise<JobDetailView | null>((settle) => (resolve = settle));
    return { promise, resolve };
}

export function showPage(name: PageName = "jobs", rows: JobRowView[] = ROWS) {
    listed = rows;
    return render(<RowsList name={name} initial={jobPage(rows)} />);
}

export function panel(): HTMLDialogElement | null {
    return document.querySelector("dialog.details-panel");
}

export function heading(): string | null {
    return within(panel() as HTMLElement).getByRole("heading", { level: 2 }).textContent;
}

export function section(title: string): HTMLElement {
    return within(panel() as HTMLElement)
        .getByRole("heading", { level: 3, name: title })
        .closest("section") as HTMLElement;
}

export async function openTitle(title: string) {
    await userEvent.click(screen.getByRole("link", { name: title }));
}

"use client";

import { useActionState, useState } from "react";
import type { Resume, ResumeProfile } from "../../../src/db/resumeStore.js";
import { RESUME_ERRORS, sizeProblem } from "../../../src/resume/limits.js";
import { uploadedLabel, type ResumeShown } from "../../../src/web/resumeView.js";
import { useLocalTimeZone } from "../../lib/appliedTime.js";
import { uploadResume } from "../../lib/resumeActions.js";
import { Panel } from "../sections/Panel.js";
import { ProfileEditor } from "./ProfileEditor.js";

interface Upload {
    resume: Resume | null;
    error: string | null;
}

/** Uploads the chosen file unless none is chosen or it is too large to send, keeping the resume shown when the upload is refused. */
async function uploaded(previous: Upload, file: File | null): Promise<Upload> {
    if (file === null) return { ...previous, error: RESUME_ERRORS.type };
    const tooLarge = sizeProblem(file.size);
    if (tooLarge !== null) return { ...previous, error: tooLarge };
    const form = new FormData();
    form.set("resume", file);
    const result = await uploadResume(form);
    return result.ok ? { resume: result.resume, error: null } : { ...previous, error: result.error };
}

/** Renders the Resume section: the upload form, the resume in use shown as plain text, and the profile extracted from an uploaded one. */
export function ResumeSection({ shown, profile }: { shown: ResumeShown; profile: ResumeProfile | null }) {
    const [chosen, setChosen] = useState<File | null>(null);
    const [state, upload, uploading] = useActionState(uploaded, { resume: null, error: null });
    return (
        <Panel title="Resume">
            <form action={() => upload(chosen)}>
                <fieldset role="group">
                    <input type="file" name="resume" accept=".md,.txt,.pdf,.docx" aria-label="Resume file" onChange={(event) => setChosen(event.target.files?.[0] ?? null)} />
                    <button disabled={uploading}>Upload</button>
                </fieldset>
                {state.error && (
                    <p role="alert" className="note">
                        {state.error}
                    </p>
                )}
            </form>
            <ResumeInUse shown={state.resume === null ? shown : { kind: "stored", resume: state.resume }} profile={profile} />
        </Panel>
    );
}

/** Shows the resume in use and, for an uploaded one, the profile extracted from it. */
function ResumeInUse({ shown, profile }: { shown: ResumeShown; profile: ResumeProfile | null }) {
    return (
        <>
            <ResumeText shown={shown} />
            {shown.kind === "stored" && <ProfileEditor resume={shown.resume} profile={profile} />}
        </>
    );
}

/** Shows the resume in use and where it came from, never rendering its text as markup. */
function ResumeText({ shown }: { shown: ResumeShown }) {
    const timeZone = useLocalTimeZone();
    if (shown.kind === "none") return <p>No resume yet</p>;
    return (
        <>
            <p>{shown.kind === "stored" ? uploadedLabel(shown.resume, timeZone) : "Using data/resume.md"}</p>
            <pre>{shown.kind === "stored" ? shown.resume.text : shown.text}</pre>
        </>
    );
}

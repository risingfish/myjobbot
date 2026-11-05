"use client";

import { useState } from "react";
import type { Resume, ResumeProfile } from "../../../src/db/resumeStore.js";
import { isStale } from "../../../src/resumeProfile/profile.js";
import { editedField } from "../../../src/web/settingsForm.js";
import { useExtract } from "../../lib/useExtract.js";
import { useProfileSave } from "../../lib/useProfileSave.js";
import type { SaveStatus } from "../../lib/useSave.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";
import { usePreferencesDraft } from "./PreferencesDraft.js";
import { Setting } from "./SettingParts.js";
import { SkillClouds } from "./SkillClouds.js";

/** Renders the profile extracted from the uploaded resume: the button that extracts it, then its summary and its skills by group. */
export function ProfileEditor({ resume, profile }: { resume: Resume; profile: ResumeProfile | null }) {
    const [saved, setSaved] = useState(profile);
    return (
        <section aria-label="Profile">
            <ExtractControl again={saved !== null} confirmFirst={(saved?.editedAt ?? null) !== null} onExtracted={setSaved} />
            {saved !== null && <ProfileFields key={saved.extractedAt} resume={resume} saved={saved} onSaved={setSaved} />}
        </section>
    );
}

interface FieldsProps {
    resume: Resume;
    saved: ResumeProfile;
    onSaved: (profile: ResumeProfile) => void;
}

/** Renders the profile's summary, saved when the owner leaves it, and its skills, saved on each change, with how the last save went. */
function ProfileFields({ resume, saved, onSaved }: FieldsProps) {
    const [summary, setSummary] = useState(saved.summary);
    const { status, refused, save } = useProfileSave(onSaved);
    const saveSummary = () => summary !== saved.summary && void save({ summary, skills: saved.skills });
    return (
        <>
            {isStale(saved, resume) && <p className="note">From an earlier resume</p>}
            <Setting label="Summary">
                <textarea aria-label="Profile summary" rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} onBlur={saveSummary} />
                <UseSummary summary={summary} />
            </Setting>
            <SkillClouds skills={saved.skills} onChange={(skills) => void save({ summary, skills })} />
            <ProfileSaveNote status={status} refused={refused} />
        </>
    );
}

/** Says the last profile edit is saving, why it was refused, or that it couldn't be saved. */
function ProfileSaveNote({ status, refused }: { status: SaveStatus; refused: string | null }) {
    return (
        <footer className="save-status" aria-live="polite">
            {status === "saving" && <small className="note">Saving…</small>}
            {refused !== null && (
                <p role="alert" className="note">
                    {refused}
                </p>
            )}
            <SaveFailedNote status={status} />
        </footer>
    );
}

/** Copies the summary into the Preferences box, marked edited so the owner saves it there, and scrolls to it; nothing is saved here. */
function UseSummary({ summary }: { summary: string }) {
    const { setPreferences } = usePreferencesDraft();
    const use = () => {
        setPreferences(editedField(summary));
        document.getElementById("preferences")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    return (
        <button type="button" className="secondary" onClick={use}>
            Use summary in Preferences
        </button>
    );
}

interface ExtractProps {
    again: boolean;
    confirmFirst: boolean;
    onExtracted: (profile: ResumeProfile) => void;
}

/** Renders the button that extracts the profile, asking first in a dialog when extracting again would replace the owner's edits. */
function ExtractControl({ again, confirmFirst, onExtracted }: ExtractProps) {
    const [asking, setAsking] = useState(false);
    const { busy, error, extract } = useExtract(onExtracted);
    const start = () => {
        setAsking(false);
        void extract();
    };
    return (
        <>
            <button type="button" aria-busy={busy} disabled={busy} onClick={() => (confirmFirst ? setAsking(true) : start())}>
                {busy ? "Extracting…" : again ? "Extract again" : "Extract profile"}
            </button>
            <ExtractError error={error} />
            <ReplaceDialog open={asking} onReplace={start} onCancel={() => setAsking(false)} />
        </>
    );
}

/** Says why the last extraction failed, once one has. */
function ExtractError({ error }: { error: string | null }) {
    if (error === null) return null;
    return (
        <p role="alert" className="note">
            {error}
        </p>
    );
}

/** Asks before an extraction replaces a profile the owner has edited. */
function ReplaceDialog({ open, onReplace, onCancel }: { open: boolean; onReplace: () => void; onCancel: () => void }) {
    return (
        <dialog open={open} aria-label="Replace the edited profile?">
            <article>
                <p>Extracting again replaces the profile you edited.</p>
                <footer>
                    <button type="button" className="secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" onClick={onReplace}>
                        Replace
                    </button>
                </footer>
            </article>
        </dialog>
    );
}

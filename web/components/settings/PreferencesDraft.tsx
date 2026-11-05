"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { FieldView } from "../../../src/web/settingsView.js";

interface Draft {
    preferences: FieldView<string>;
    setPreferences: (field: FieldView<string>) => void;
}

const DraftContext = createContext<Draft | null>(null);

/** Holds the Preferences box's text for the sections inside it, so the Resume section can put its summary there for the owner to save. */
export function PreferencesDraft({ initial, children }: { initial: FieldView<string>; children: ReactNode }) {
    const [preferences, setPreferences] = useState(initial);
    return <DraftContext value={{ preferences, setPreferences }}>{children}</DraftContext>;
}

/** Gives the Preferences box's text and the way to change it, from the PreferencesDraft around the section. */
export function usePreferencesDraft(): Draft {
    const draft = useContext(DraftContext);
    if (draft === null) throw new Error("usePreferencesDraft needs a PreferencesDraft around it");
    return draft;
}

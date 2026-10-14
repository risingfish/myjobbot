import type { Metadata } from "next";
import { Panel } from "../../components/sections/Panel.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Renders the Settings page, with one empty panel where settings will go. */
export default function SettingsPage() {
    return (
        <main aria-label="Settings">
            <Panel />
        </main>
    );
}

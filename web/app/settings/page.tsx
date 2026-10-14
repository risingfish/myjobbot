import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Renders the Settings page, which has no settings yet. */
export default function SettingsPage() {
  return <main aria-label="Settings" />;
}

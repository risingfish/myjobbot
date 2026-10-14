import type { Metadata } from "next";
import { DataPage } from "../../components/pages/DataPage.js";

export const metadata: Metadata = { title: "All jobs" };
export const dynamic = "force-dynamic";

/** Renders the All jobs page from the database, on the server. */
export default function JobsPage() {
    return <DataPage name="jobs" label="All jobs" />;
}

import type { Metadata } from "next";
import { DataPage } from "../../components/pages/DataPage.js";

export const metadata: Metadata = { title: "Applied" };
export const dynamic = "force-dynamic";

/** Renders the Applied page, the jobs marked applied, from the database on the server. */
export default function AppliedPage() {
    return <DataPage name="applied" label="Applied" />;
}

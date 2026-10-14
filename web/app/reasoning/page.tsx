import type { Metadata } from "next";
import { DataPage } from "../../components/pages/DataPage.js";

export const metadata: Metadata = { title: "Reasoning" };
export const dynamic = "force-dynamic";

/** Renders the Reasoning page from the database, on the server. */
export default function ReasoningPage() {
    return <DataPage name="reasoning" label="Reasoning" />;
}

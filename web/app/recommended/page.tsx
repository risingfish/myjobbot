import type { Metadata } from "next";
import { DataPage } from "../../components/pages/DataPage.js";

export const metadata: Metadata = { title: "Recommended" };
export const dynamic = "force-dynamic";

/** Renders the Recommended page from the database, on the server. */
export default function RecommendedPage() {
  return <DataPage name="recommended" label="Recommended" />;
}

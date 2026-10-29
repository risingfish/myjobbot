import type { PageName } from "../../../src/web/api.js";
import { loadRows } from "../../lib/rows.js";
import { getUiState } from "../../lib/uiState.js";
import { RowsList } from "./RowsList.js";

/** Reads a data page's first rows on the server and renders them, so they arrive in the HTML. */
export async function DataPage({ name, label }: { name: PageName; label: string }) {
    const { views, config, sourceNames } = await getUiState();
    const initial = await loadRows(views, { config, sourceNames }, { name, offset: 0 });
    return (
        <main aria-label={label}>
            <RowsList name={name} initial={initial} />
        </main>
    );
}

import type { JobDetailRow } from "../db/store.js";
import type { JobDetailView } from "./api.js";
import { toJobRowView, type RowContext } from "./rowViews.js";

/** Converts one stored job into the details its panel shows. */
export function toJobDetailView(row: JobDetailRow, context: RowContext): JobDetailView {
    return { job: { ...toJobRowView(row, context), pay: row.compensation, workplace: row.workplace_type } };
}

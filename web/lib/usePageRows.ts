import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { JobRowView, PageData, PageName } from "../../src/web/api.js";
import { loadMoreRows } from "./actions.js";
import { jobKey, withJobHidden, withMore, withoutJob, type LoadedPage, type RowsState } from "./pageRows.js";

export interface PageRows extends RowsState {
  loadMore: () => void;
  markHidden: (job: JobRowView, hidden: boolean) => void;
}

type SetRows = Dispatch<SetStateAction<RowsState>>;

interface NextPage {
  name: PageName;
  offset: number | null;
  version: number;
}

/** Keeps a page's rows, starting from the server-rendered first page, loading more on request and following hides. */
export function usePageRows(name: PageName, initial: PageData): PageRows {
  const [state, setState] = useState<RowsState>({ data: initial, error: null, moreError: null, version: 0 });
  const loadMore = useLoadMore({ name, offset: state.data?.nextOffset ?? null, version: state.version }, setState);
  const markHidden = useCallback((job: JobRowView, hidden: boolean) => {
    const removing = hidden && name === "recommended";
    const change = removing ? withoutJob(jobKey(job)) : withJobHidden(jobKey(job), hidden);
    setState((current) => ({ ...current, data: current.data && change(current.data), version: current.version + Number(removing) }));
  }, [name]);
  return { ...state, loadMore, markHidden };
}

/** Returns a loader for the next page of rows that never runs twice at once, or does nothing at the end. */
function useLoadMore({ name, offset, version }: NextPage, setState: SetRows): () => void {
  const loading = useRef(false);
  return useCallback(() => {
    if (offset === null || loading.current) return;
    loading.current = true;
    void loadPage(name, offset).then((more) => {
      loading.current = false;
      setState((current) => withMore(current, more, version));
    });
  }, [name, offset, version, setState]);
}

/** Asks the server for a page of rows, turning a failure into an error message to show instead. */
async function loadPage(name: PageName, offset: number): Promise<LoadedPage> {
  try {
    return { data: await loadMoreRows(name, offset), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { JobRowView, PageData, PageName } from "../api.js";
import { fetchJson } from "./fetchJson.js";
import { jobKey, withJobHidden, withMore, withoutJob, type LoadedPage, type RowsState } from "./pageRows.js";

export interface PageRows extends RowsState {
  loadMore: () => void;
  markHidden: (job: JobRowView, hidden: boolean) => void;
}

type SetRows = Dispatch<SetStateAction<RowsState>>;

const LOADING: RowsState = { data: null, error: null, moreError: null, version: 0 };

/** Loads a web UI page's rows, loads more on request, and keeps the rows in step with jobs being hidden. */
export function usePageRows(name: PageName): PageRows {
  const [state, setState] = useState<RowsState>(LOADING);
  useFirstPage(name, setState);
  const loadMore = useLoadMore(nextPageUrl(name, state.data), state.version, setState);
  const markHidden = useCallback((job: JobRowView, hidden: boolean) => {
    const removing = hidden && name === "recommended";
    const change = removing ? withoutJob(jobKey(job)) : withJobHidden(jobKey(job), hidden);
    setState((current) => ({ ...current, data: current.data && change(current.data), version: current.version + Number(removing) }));
  }, [name]);
  return { ...state, loadMore, markHidden };
}

/** Loads the first page of rows, cancelling the request if the page goes away first. */
function useFirstPage(name: PageName, setState: SetRows): void {
  useEffect(() => {
    const controller = new AbortController();
    void loadPage(`/api/pages/${name}`, controller.signal).then((page) => controller.signal.aborted || setState({ ...page, moreError: null, version: 0 }));
    return () => controller.abort();
  }, [name, setState]);
}

/** Returns a loader for the next page of rows that never runs twice at once, or does nothing at the end. */
function useLoadMore(url: string | null, version: number, setState: SetRows): () => void {
  const loading = useRef(false);
  return useCallback(() => {
    if (url === null || loading.current) return;
    loading.current = true;
    void loadPage(url).then((more) => {
      loading.current = false;
      setState((current) => withMore(current, more, version));
    });
  }, [url, version, setState]);
}

/** Returns the address of the page after the rows shown, or null when they reach the end. */
function nextPageUrl(name: PageName, data: PageData | null): string | null {
  const offset = data?.nextOffset ?? null;
  return offset === null ? null : `/api/pages/${name}?offset=${offset}`;
}

/** Fetches a page of rows, turning a failure into an error message to show instead. */
async function loadPage(url: string, signal?: AbortSignal): Promise<LoadedPage> {
  try {
    return { data: await fetchJson<PageData>(url, signal), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

import { useEffect } from "react";

/** Keeps the browser tab's title naming the page being shown. */
export function useDocumentTitle(label: string): void {
  useEffect(() => {
    document.title = `myjobbot · ${label}`;
  }, [label]);
}

import { useCallback, useEffect, useState } from "react";

export interface Navigation {
  path: string;
  navigate: (to: string) => void;
}

/** Tracks the address bar's path and switches pages in place, keeping the browser's back button working. */
export function usePath(): Navigation {
  const [path, setPath] = useState(() => location.pathname);
  const followAddress = useCallback(() => setPath(location.pathname), []);
  usePopState(followAddress);
  const navigate = useCallback((to: string) => {
    history.pushState(null, "", to);
    setPath(to);
  }, []);
  return { path, navigate };
}

/** Calls the listener whenever the browser's back or forward buttons change the address. */
function usePopState(listener: () => void): void {
  useEffect(() => {
    addEventListener("popstate", listener);
    return () => removeEventListener("popstate", listener);
  }, [listener]);
}

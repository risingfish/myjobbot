import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let patched = false;

function patchPushState(): void {
    if (patched) return;
    patched = true;
    const push = history.pushState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
        push(...args);
        for (const listener of listeners) listener();
    };
}

function subscribe(listener: () => void): () => void {
    patchPushState();
    listeners.add(listener);
    window.addEventListener("popstate", listener);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("popstate", listener);
    };
}

export function useSearchParams(): URLSearchParams {
    const search = useSyncExternalStore(subscribe, () => window.location.search);
    return new URLSearchParams(search);
}

import type { ReactNode } from "react";

/** Renders a link that opens in a new tab, or just its text when there is no safe address. */
export function ExternalLink({ url, children }: { url: string | null; children: ReactNode }) {
    if (url === null) return <>{children}</>;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    );
}

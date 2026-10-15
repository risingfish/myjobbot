import type { ReactNode } from "react";

interface ExternalLinkProps {
    url: string | null;
    children: ReactNode;
    title?: string;
}

/** Renders a link that opens in a new tab, or just its text when there is no safe address. */
export function ExternalLink({ url, children, title }: ExternalLinkProps) {
    if (url === null) return <span title={title}>{children}</span>;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" title={title}>
            {children}
        </a>
    );
}

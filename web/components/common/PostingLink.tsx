/** Renders a small icon that opens a job's original posting in a new tab, or nothing when there is no safe address. */
export function PostingLink({ url }: { url: string | null }) {
    if (url === null) return null;
    return (
        <a className="posting-link" href={url} target="_blank" rel="noopener noreferrer" aria-label="Open the posting" title="Open the posting" data-keeps-panel>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3h7v7" />
                <path d="M10 14 21 3" />
                <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
        </a>
    );
}

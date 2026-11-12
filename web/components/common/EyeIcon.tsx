/** Draws an eye: open for a job that is shown, closed for one that is hidden. */
export function EyeIcon({ open }: { open: boolean }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
                <>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                </>
            ) : (
                <path d="M2 10c3 4.5 6.5 6.5 10 6.5S19 14.5 22 10M4.5 13.5 3 16M9 16l-.7 3M15 16l.7 3M19.5 13.5 21 16" />
            )}
        </svg>
    );
}

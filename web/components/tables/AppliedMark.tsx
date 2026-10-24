/** Shows whether the owner has applied to a job, as a blue question mark or a green check, for the control around it to name. */
export function AppliedMark({ applied }: { applied: boolean }) {
    return (
        <span className={applied ? "applied" : "unapplied"} aria-hidden="true">
            {applied ? "✓" : "?"}
        </span>
    );
}

/** Renders the page footer naming the database shown and when the server answered. */
export function Footer({ dbPath, renderedAt }: { dbPath: string; renderedAt: string }) {
    return (
        <footer>
            <small>
                {dbPath} · rendered {renderedAt}
            </small>
        </footer>
    );
}

/** Renders the page footer naming the database shown and when the server answered. */
export function Footer({ database, renderedAt }: { database: string; renderedAt: string }) {
    return (
        <footer>
            <small>
                {database} · rendered {renderedAt}
            </small>
        </footer>
    );
}

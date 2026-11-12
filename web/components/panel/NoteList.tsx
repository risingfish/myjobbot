/** Lists a score's reasons or gaps under a small heading, saying "none" when there are none. */
export function NoteList({ label, notes }: { label: string; notes: string[] }) {
    return (
        <>
            <h4>{label}</h4>
            {notes.length === 0 ? (
                <p>none</p>
            ) : (
                <ul className="details-notes">
                    {notes.map((note, index) => (
                        <li key={`${index}:${note}`}>{note}</li>
                    ))}
                </ul>
            )}
        </>
    );
}

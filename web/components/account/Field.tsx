import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    name: string;
    label: string;
    invalid?: boolean;
    note?: string | null;
}

/** Renders a labelled input with its note right under it: a hint, or, when the field was refused, the refusal in Pico's error colour. */
export function Field({ name, label, invalid = false, note = null, ...input }: FieldProps) {
    const noteId = `${name}-note`;
    return (
        <>
            <label htmlFor={name}>{label}</label>
            <input id={name} name={name} aria-invalid={invalid || undefined} aria-describedby={note === null ? undefined : noteId} {...input} />
            {note !== null && (
                <small id={noteId} role={invalid ? "alert" : undefined}>
                    {note}
                </small>
            )}
        </>
    );
}

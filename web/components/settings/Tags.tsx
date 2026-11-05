import { useState, type KeyboardEvent, type ReactNode } from "react";

/** Renders a setting's values as a cloud of tags under its label, with a separator before what follows once there are any. */
export function TagCloud({ label, count, children }: { label: string; count: number; children: ReactNode }) {
    if (count === 0) return null;
    return (
        <>
            <ul className="tags" aria-label={label}>
                {children}
            </ul>
            <hr />
        </>
    );
}

/** Renders one setting value as a tag, with its action buttons, shown on hover or focus, and the problems a refused save found with it. */
export function Tag({ text, problems, children }: { text: string; problems: ReactNode; children: ReactNode }) {
    return (
        <li className="tag">
            <span>{text}</span>
            {children}
            {problems}
        </li>
    );
}

/** Renders one of a tag's action buttons as a symbol, named for screen readers by its label. */
export function TagButton({ label, symbol, remove = false, onClick }: { label: string; symbol: string; remove?: boolean; onClick: () => void }) {
    return (
        <button type="button" className={remove ? "tag-action tag-remove" : "tag-action"} aria-label={label} title={label} onClick={onClick}>
            {symbol}
        </button>
    );
}

/** Renders the field for adding a term to a list, joined to its Add button as a Pico group; Enter adds too. */
export function AddTerm({ label, onAdd, placeholder = "Add a term" }: { label: string; onAdd: (typed: string) => void; placeholder?: string }) {
    const [typed, setTyped] = useState("");
    const add = () => {
        onAdd(typed);
        setTyped("");
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        add();
    };
    return (
        <fieldset role="group">
            <input aria-label={`New term for ${label}`} placeholder={placeholder} value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={onKeyDown} />
            <button type="button" className="secondary" aria-label={`Add to ${label}`} onClick={add}>
                Add
            </button>
        </fieldset>
    );
}

import type { ReactNode } from "react";

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

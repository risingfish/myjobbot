import type { ReactNode } from "react";

interface PanelProps {
    title: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}

/** Renders a titled panel with optional actions and a body. */
export function Panel({ title, actions, children }: PanelProps) {
    return (
        <div className="panel">
            <h4>{title}</h4>
            {children}
            {actions && <footer>{actions}</footer>}
        </div>
    );
}

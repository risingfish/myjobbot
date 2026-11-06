import type { ReactNode } from "react";

/** Renders the bar across the top of every page: the app's name on the left and, when given, its controls on the right. */
export function TitleBar({ children }: { children?: ReactNode }) {
    return (
        <nav aria-label="myjobbot">
            <ul>
                <li>
                    <h1 className="main-title">myjobbot</h1>
                </li>
            </ul>
            {children !== undefined && (
                <ul>
                    <li>{children}</li>
                </ul>
            )}
        </nav>
    );
}

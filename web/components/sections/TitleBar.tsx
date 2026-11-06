import { Children, type ReactNode } from "react";

/** Renders the bar across the top of every page: the app's name on the left and, when given, its controls on the right, each its own item. */
export function TitleBar({ children }: { children?: ReactNode }) {
    const controls = Children.toArray(children);
    return (
        <nav aria-label="myjobbot">
            <ul>
                <li>
                    <h1 className="main-title">myjobbot</h1>
                </li>
            </ul>
            {controls.length > 0 && (
                <ul>
                    {controls.map((control, index) => (
                        <li key={index}>{control}</li>
                    ))}
                </ul>
            )}
        </nav>
    );
}

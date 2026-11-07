import type { ReactNode } from "react";
import { TitleBar } from "../../components/sections/TitleBar.js";

/** Wraps the pages anyone may open in the app's name alone: no navigation and nothing about the server. */
export default function PublicLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <header className="container-fluid site-header">
                <TitleBar />
            </header>
            <main className="container">{children}</main>
        </>
    );
}

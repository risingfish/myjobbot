import type { ReactNode } from "react";
import { Footer } from "../../components/sections/Footer.js";
import { Nav } from "../../components/menus/Nav.js";
import { Header } from "../../components/sections/Header.js";
import { dbLabel } from "../../lib/database.js";

/** Wraps the signed-in pages in the shared header, the tabs below it and the footer; it never loads the config, so config errors reach the error page. */
export default function AppLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <Header />
            <Nav />
            {children}
            <Footer database={dbLabel()} renderedAt={new Date().toISOString()} />
        </>
    );
}

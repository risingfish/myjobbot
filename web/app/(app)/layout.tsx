import type { ReactNode } from "react";
import { AccountBanner } from "../../components/sections/AccountBanner.js";
import { Footer } from "../../components/sections/Footer.js";
import { Nav } from "../../components/menus/Nav.js";
import { Header } from "../../components/sections/Header.js";
import { dbLabel } from "../../lib/database.js";
import { requireSession } from "../../lib/session.js";

/** Wraps the signed-in pages in the shared header, the tabs below it and the footer; it never loads the config, so config errors reach the error page. */
export default async function AppLayout({ children }: { children: ReactNode }) {
    const { account } = await requireSession();
    return (
        <>
            <Header name={account.name} />
            <Nav admin={account.isAdmin} />
            <AccountBanner account={account} />
            {children}
            <Footer database={dbLabel()} renderedAt={new Date().toISOString()} />
        </>
    );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "../components/sections/Footer.js";
import { Header } from "../components/sections/Header.js";
import { dbLabel } from "../lib/uiState.js";
import "./styles.css";

export const metadata: Metadata = { title: { template: "myjobbot · %s", default: "myjobbot" } };
export const dynamic = "force-dynamic";

/** Wraps every page in the shared header, navigation and footer; it never loads the config, so config errors reach the error page. */
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Header />
                {children}
                <Footer database={dbLabel()} renderedAt={new Date().toISOString()} />
            </body>
        </html>
    );
}

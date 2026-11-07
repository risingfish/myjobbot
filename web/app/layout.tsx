import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@picocss/pico/css/pico.blue.min.css";
import "./styles.css";

export const metadata: Metadata = { title: { template: "myjobbot · %s", default: "myjobbot" } };
export const dynamic = "force-dynamic";

/** Wraps every page in the document; it renders per request, so every page's scripts carry the request's nonce. */
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

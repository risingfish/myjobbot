import type { Metadata } from "next";
import { LinkButton } from "../../../components/account/LinkButton.js";

export const metadata: Metadata = { title: "Your link" };

/** Renders the page every emailed link opens; the link itself stays in the address's fragment, never sent to the server until its button is pressed. */
export default function LinkPage() {
    return (
        <article>
            <header>
                <h2>myjobbot</h2>
            </header>
            <LinkButton />
        </article>
    );
}

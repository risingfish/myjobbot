import type { Metadata } from "next";
import { redirect } from "next/navigation.js";
import { safeReturnPath } from "../../../../src/accounts/returnPath.js";
import { SignInForm } from "../../../components/account/SignInForm.js";
import { currentSession } from "../../../lib/currentSession.js";

export const metadata: Metadata = { title: "Sign in" };

/** Renders the sign-in page, or sends a browser that is already signed in on to the page it asked for. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const asked = (await searchParams).next;
    const next = safeReturnPath(typeof asked === "string" ? asked : null);
    if ((await currentSession()) !== null) redirect(next);
    return (
        <article>
            <header>
                <h2>Sign in</h2>
            </header>
            <SignInForm next={next} />
            <footer>
                <small>
                    Have a code from an admin? <a href="/create-account">Create an account</a>
                </small>
            </footer>
        </article>
    );
}

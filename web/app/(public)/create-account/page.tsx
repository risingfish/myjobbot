import type { Metadata } from "next";
import { CreateAccountForm } from "../../../components/account/CreateAccountForm.js";

export const metadata: Metadata = { title: "Create account" };

/** Renders the public account creation page, which makes an account only with a code from an admin. */
export default function CreateAccountPage() {
    return (
        <article>
            <header>
                <h2>Create account</h2>
            </header>
            <CreateAccountForm />
            <footer>
                <small>
                    Have an account? <a href="/sign-in">Sign in</a>
                </small>
            </footer>
        </article>
    );
}

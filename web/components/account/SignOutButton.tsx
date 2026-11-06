import { signOutNow } from "../../lib/signInActions.js";

/** Renders the Sign out button, a form that ends this browser's sign-in. */
export function SignOutButton() {
    return (
        <form action={signOutNow} className="sign-out">
            <button type="submit" className="secondary outline">
                Sign out
            </button>
        </form>
    );
}

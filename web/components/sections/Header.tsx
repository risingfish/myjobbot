import { SignOutButton } from "../account/SignOutButton.js";
import { TitleBar } from "./TitleBar.js";

/** Renders the top of every signed-in page: the title bar with Sign out on the right. */
export function Header() {
    return (
        <header className="container-fluid site-header">
            <TitleBar>
                <SignOutButton />
            </TitleBar>
        </header>
    );
}

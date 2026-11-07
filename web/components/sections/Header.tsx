import { SignOutButton } from "../account/SignOutButton.js";
import { TitleBar } from "./TitleBar.js";

/** Renders the top of every signed-in page: the title bar with the account's name and Sign out on the right. */
export function Header({ name }: { name: string }) {
    return (
        <header className="container-fluid site-header">
            <TitleBar>
                <span className="account-name">{name}</span>
                <SignOutButton />
            </TitleBar>
        </header>
    );
}

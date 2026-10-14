import { Nav } from "../menus/Nav.js";

/** Renders the top of every page: the app's name and the navigation menu. */
export function Header() {
    return (
        <header>
            <h1>myjobbot</h1>
            <Nav />
        </header>
    );
}

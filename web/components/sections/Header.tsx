import { Nav } from "../menus/Nav.js";

/** Renders the top of every page: the app's name and the navigation menu. */
export function Header() {
    return (
        <header className="container-fluid">
            <h1 className="main-title">myjobbot</h1>
            <Nav />
        </header>
    );
}

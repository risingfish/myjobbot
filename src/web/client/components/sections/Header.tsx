import type { Navigation } from "../../usePath.js";
import { Nav } from "../menus/Nav.js";

/** Renders the top of every page: the app's name and the navigation menu. */
export function Header(navigation: Navigation) {
  return (
    <header>
      <h1>myjobbot</h1>
      <Nav {...navigation} />
    </header>
  );
}

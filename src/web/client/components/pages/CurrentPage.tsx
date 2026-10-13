import { PAGE_NAMES, PAGES } from "../../../api.js";
import { RowsPage } from "./RowsPage.js";
import { SettingsPage } from "./SettingsPage.js";

/** Returns the name of the page at an address, as the navigation shows it. */
export function pageLabel(path: string): string {
  return PAGES.find((page) => page.path === path)?.label ?? "Not found";
}

/** Shows the page for the address in the address bar, labelled with its name. */
export function CurrentPage({ path }: { path: string }) {
  return <main aria-label={pageLabel(path)}><PageBody path={path} /></main>;
}

/** Chooses what an address shows: a page of rows, the settings page, or a note that it does not exist. */
function PageBody({ path }: { path: string }) {
  const name = PAGE_NAMES.find((candidate) => `/${candidate}` === path);
  if (name) return <RowsPage key={name} name={name} />;
  return path === "/settings" ? <SettingsPage /> : <p>Not found</p>;
}

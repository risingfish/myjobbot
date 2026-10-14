import { PAGES } from "../../../api.js";
import { NavLink } from "./NavLink.js";
import type { Navigation } from "../../usePath.js";

/** Renders the navigation bar of all web UI pages, marking the one being shown. */
export function Nav({ path, navigate }: Navigation) {
  const links = PAGES.map((page) => (
    <NavLink key={page.path} href={page.path} current={page.path === path} navigate={navigate}>{page.label}</NavLink>
  ));
  return <nav>{links}</nav>;
}

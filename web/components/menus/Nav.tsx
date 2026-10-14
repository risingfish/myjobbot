"use client";

import NextLink from "next/link.js";
import { usePathname } from "next/navigation.js";
import { PAGES } from "../../lib/pages.js";

// next/link is CommonJS: under nodenext its default import is the module, and the module's default is the component.
const Link = NextLink.default;

/** Renders the navigation bar of all web UI pages, marking the one at the current address. */
export function Nav() {
  const path = usePathname();
  const links = PAGES.map((page) => (
    <Link key={page.path} href={page.path} className={page.path === path ? "current" : undefined}>{page.label}</Link>
  ));
  return <nav>{links}</nav>;
}

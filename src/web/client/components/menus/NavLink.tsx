import type { MouseEvent, ReactNode } from "react";

interface NavLinkProps {
  href: string;
  current: boolean;
  navigate: (to: string) => void;
  children: ReactNode;
}

/** Renders a navigation link that switches pages in place on a plain click, marking the current page. */
export function NavLink({ href, current, navigate, children }: NavLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };
  return <a href={href} className={current ? "current" : undefined} onClick={onClick}>{children}</a>;
}

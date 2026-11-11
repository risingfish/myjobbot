import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { Nav } from "../../web/components/menus/Nav.js";
import { PAGES } from "../../web/lib/pages.js";

const navigation = vi.hoisted(() => ({ path: "/jobs" }));

vi.mock("next/navigation.js", () => ({ usePathname: () => navigation.path }));

vi.mock("next/link.js", async () => {
    const { createElement } = await import("react");
    const Link = ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => createElement("a", { href, className }, children);
    return { default: { default: Link } };
});

function linkClass(name: string): string {
    return screen.getByRole("link", { name }).className;
}

test("the navigation marks the page at the current address", () => {
    navigation.path = "/jobs";
    render(<Nav admin={false} />);
    expect(linkClass("All jobs")).toBe("current");
    expect(linkClass("Recommended")).toBe("");
});

test("every page in the menu list gets a link, in order, and Monitoring only for an admin", () => {
    navigation.path = "/recommended";
    const view = render(<Nav admin />);
    const links = () => screen.getAllByRole("link").map((link) => [link.getAttribute("href"), link.textContent]);
    expect(links()).toEqual(PAGES.map((page) => [page.path, page.label]));
    view.rerender(<Nav admin={false} />);
    expect(links()).toEqual(PAGES.filter((page) => page.path !== "/monitoring").map((page) => [page.path, page.label]));
});

test("the marking follows the address when it changes", () => {
    navigation.path = "/jobs";
    const view = render(<Nav admin={false} />);
    navigation.path = "/settings";
    view.rerender(<Nav admin={false} />);
    expect(linkClass("Settings")).toBe("current");
    expect(linkClass("All jobs")).toBe("");
});

import { screen, within } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Header } from "../../web/components/sections/Header.js";

vi.mock("../../web/lib/signInActions.js", () => ({ signOutNow: vi.fn() }));

test("the header's title bar has the app's name on the left and Sign out on the right, and the page links sit outside it", () => {
    render(<Header />);
    const [left, right] = within(screen.getByRole("navigation", { name: "myjobbot" })).getAllByRole("list");
    expect(within(left as HTMLElement).getByRole("heading", { level: 1 }).textContent).toBe("myjobbot");
    expect(within(right as HTMLElement).getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
});

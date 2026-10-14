import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import ErrorPage from "../../web/app/error.js";

test("a failed page shows the error message as text, never as markup", () => {
    const { container } = render(<ErrorPage error={new Error("broken <script>alert(1)</script>")} />);
    expect(screen.getByText("broken <script>alert(1)</script>")).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
});

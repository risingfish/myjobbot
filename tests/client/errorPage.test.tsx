import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { MESSAGES } from "../../src/accounts/messages.js";
import ErrorPage from "../../web/app/error.js";

test("a failed page shows a fixed message and never the error's own text", () => {
    const { container } = render(<ErrorPage />);
    expect(screen.getByText(MESSAGES.page_failed)).toBeTruthy();
    expect(container.textContent).not.toContain("broken");
});

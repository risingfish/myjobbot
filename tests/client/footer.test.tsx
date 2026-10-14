import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { Footer } from "../../web/components/sections/Footer.js";

test("the footer names the database and when the server answered", () => {
    render(<Footer dbPath="test.db" renderedAt="2026-10-03T12:00:00.000Z" />);
    expect(screen.getByText("test.db · rendered 2026-10-03T12:00:00.000Z")).toBeTruthy();
});

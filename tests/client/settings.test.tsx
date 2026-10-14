import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "../../src/web/client/App.js";
import { jsonResponse, stubFetch, TEST_META } from "../helpers/fetchStub.js";
import { jobPage } from "../helpers/rowFixtures.js";

test("the settings page is blank, marked current, and titled", () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META) });
  history.replaceState(null, "", "/settings");
  const { container } = render(<App />);
  expect(screen.getByRole("link", { name: "Settings" }).className).toBe("current");
  expect(document.title).toBe("myjobbot · Settings");
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector("main")?.childElementCount).toBe(0);
  expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

test("the settings page opens from another page without a reload", async () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META), "/api/pages/recommended": () => jsonResponse(jobPage([])) });
  history.replaceState(null, "", "/recommended");
  render(<App />);
  await userEvent.click(screen.getByRole("link", { name: "Settings" }));
  expect(location.pathname).toBe("/settings");
  expect(screen.getByRole("main").getAttribute("aria-label")).toBe("Settings");
});

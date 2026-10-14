import { screen } from "@testing-library/dom";
import { act, render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { App } from "../../src/web/client/App.js";
import { jsonResponse, stubFetch, TEST_META } from "../helpers/fetchStub.js";

function renderAt(path: string) {
  history.replaceState(null, "", path);
  return render(<App />);
}

test("the navigation marks the page in the address bar", () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META) });
  renderAt("/jobs");
  expect(screen.getByRole("link", { name: "All jobs" }).className).toBe("current");
  expect(screen.getByRole("link", { name: "Recommended" }).className).toBe("");
  expect(document.title).toBe("myjobbot · All jobs");
});

test("clicking a page link switches pages in place", async () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META) });
  const pushState = vi.spyOn(history, "pushState");
  renderAt("/jobs");
  await userEvent.click(screen.getByRole("link", { name: "Reasoning" }));
  expect(location.pathname).toBe("/reasoning");
  expect(pushState).toHaveBeenCalledWith(null, "", "/reasoning");
  expect(screen.getByRole("link", { name: "Reasoning" }).className).toBe("current");
});

test("the browser's back button brings back the earlier page", async () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META) });
  renderAt("/jobs");
  await userEvent.click(screen.getByRole("link", { name: "Settings" }));
  history.replaceState(null, "", "/jobs");
  act(() => {
    dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByRole("link", { name: "All jobs" }).className).toBe("current");
});

test("the footer names the database and when the server answered", async () => {
  stubFetch({ "/api/meta": () => jsonResponse(TEST_META) });
  renderAt("/recommended");
  expect(await screen.findByText(`test.db · rendered ${TEST_META.renderedAt}`)).toBeTruthy();
});

test("the footer stays empty when the server can't say", async () => {
  const fetchMock = stubFetch({ "/api/meta": () => jsonResponse({ error: "broken" }, 500) });
  const { container } = renderAt("/recommended");
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await act(async () => {});
  expect(container.querySelector("footer")?.textContent).toBe("");
});

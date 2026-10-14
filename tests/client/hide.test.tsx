import { screen } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { PageName } from "../../src/web/api.js";
import { RowsPage } from "../../src/web/client/components/pages/RowsPage.js";
import { jsonResponse, stubFetch, type Route } from "../helpers/fetchStub.js";
import { jobPage, jobRowView } from "../helpers/rowFixtures.js";

function showPage(name: PageName, hide: Route) {
  const fetchMock = stubFetch({ [`/api/pages/${name}`]: () => jsonResponse(jobPage([jobRowView()])), "/hide": hide });
  const view = render(<RowsPage name={name} />);
  return { fetchMock, ...view };
}

function lastHide(fetchMock: ReturnType<typeof stubFetch>) {
  const call = fetchMock.mock.calls.findLast(([input]) => String(input) === "/hide");
  const init = call?.[1];
  return { headers: new Headers(init?.headers), form: Object.fromEntries(new URLSearchParams(String(init?.body))) };
}

test("every job row offers a Hide button", async () => {
  showPage("recommended", () => new Response(null, { status: 204 }));
  expect(await screen.findByRole("button", { name: "Hide" })).toBeTruthy();
});

test("hiding on Recommended sends the hide form and removes the row", async () => {
  const { fetchMock, container } = showPage("recommended", () => new Response(null, { status: 204 }));
  await userEvent.click(await screen.findByRole("button", { name: "Hide" }));
  expect(container.querySelector("tr.job")).toBeNull();
  const sent = lastHide(fetchMock);
  expect(sent.headers.get("x-myjobbot-fetch")).toBe("1");
  expect(sent.form).toEqual({ ats: "greenhouse", job_id: "a", hidden: "1", back: "/recommended" });
});

test("hiding on All jobs marks the row and offers Unhide, which undoes it", async () => {
  const { fetchMock, container } = showPage("jobs", () => new Response(null, { status: 204 }));
  await userEvent.click(await screen.findByRole("button", { name: "Hide" }));
  expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("1");
  await userEvent.click(screen.getByRole("button", { name: "Unhide" }));
  expect(lastHide(fetchMock).form).toMatchObject({ hidden: "0", back: "/jobs" });
  expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
});

test("a failed hide leaves the row as it was and says so", async () => {
  const { container } = showPage("jobs", () => jsonResponse({ error: "nope" }, 500));
  await userEvent.click(await screen.findByRole("button", { name: "Hide" }));
  expect(await screen.findByText("Couldn't save — try again")).toBeTruthy();
  expect(container.querySelector("tr.job")?.getAttribute("data-hidden")).toBe("0");
  expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
});

test("the button is disabled while the change is being saved", async () => {
  let finish: (response: Response) => void = () => {};
  showPage("jobs", () => new Promise<Response>((resolve) => { finish = resolve; }));
  const button = await screen.findByRole("button", { name: "Hide" });
  await userEvent.click(button);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  finish(new Response(null, { status: 204 }));
  expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
});

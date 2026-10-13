import { vi } from "vitest";

export type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const TEST_META = { dbPath: "test.db", renderedAt: "2026-10-03T12:00:00.000Z" };

export function stubFetch(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const route = routes[url.pathname];
    if (!route) return jsonResponse({ error: "Not found" }, 404);
    return route(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

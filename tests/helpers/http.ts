import type { JsonGetter } from "../../src/http/client.js";

export function fakeBoard(body: unknown): JsonGetter & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    getJson: async (url) => {
      urls.push(url);
      return structuredClone(body);
    },
  };
}

export function flakyBoard(body: unknown): JsonGetter & { urls: string[] } {
  const board = fakeBoard(body);
  return {
    urls: board.urls,
    getJson: async (url) => {
      const isFirstRequest = board.urls.length === 0;
      const result = await board.getJson(url);
      if (isFirstRequest) throw new Error("board temporarily unavailable");
      return result;
    },
  };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function scriptedFetch(responses: Response[]) {
  const urls: string[] = [];
  const queue = [...responses];
  const fetchFn = async (url: string): Promise<Response> => {
    urls.push(url);
    const response = queue.shift();
    if (!response) throw new Error("scripted fetch ran out of responses");
    return response;
  };
  return { fetchFn, urls };
}

import type { JsonGetter, JsonPoster } from "../../src/http/client.js";

type FakeHttp = JsonGetter & JsonPoster;

async function noPosts(url: string): Promise<never> {
    throw new Error(`no fake POST for ${url}`);
}

export function fakeBoard(body: unknown): FakeHttp & { urls: string[] } {
    const urls: string[] = [];
    return {
        urls,
        getJson: async (url) => {
            urls.push(url);
            return structuredClone(body);
        },
        postJson: noPosts,
    };
}

export function flakyBoard(body: unknown): FakeHttp & { urls: string[] } {
    const board = fakeBoard(body);
    return {
        urls: board.urls,
        getJson: async (url) => {
            const isFirstRequest = board.urls.length === 0;
            const result = await board.getJson(url);
            if (isFirstRequest) throw new Error("board temporarily unavailable");
            return result;
        },
        postJson: noPosts,
    };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function scriptedFetch(responses: Response[]) {
    const urls: string[] = [];
    const inits: RequestInit[] = [];
    const nextResponse = responder(responses);
    const fetchFn = async (url: string, init: RequestInit): Promise<Response> => {
        urls.push(url);
        inits.push(init);
        return nextResponse();
    };
    return { fetchFn, urls, inits };
}

function responder(responses: Response[]): () => Response {
    const queue = [...responses];
    return () => {
        const response = queue.shift();
        if (!response) throw new Error("scripted fetch ran out of responses");
        return response;
    };
}

export interface RecordedRequest {
    url: string;
    headers: Record<string, string>;
}

export function routedHttp(routes: Record<string, unknown>): FakeHttp & { requests: RecordedRequest[] } {
    const requests: RecordedRequest[] = [];
    return {
        requests,
        getJson: async (url, headers = {}) => {
            requests.push({ url, headers });
            const body = routes[new URL(url).host];
            if (body === undefined) throw new Error(`no fake route for ${url}`);
            return structuredClone(body);
        },
        postJson: noPosts,
    };
}

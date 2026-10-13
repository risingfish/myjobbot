import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FileConfig } from "../config/schema.js";
import type { JobViews } from "../db/jobViews.js";
import { describeError } from "../errors.js";
import { PAGE_NAMES, PAGES, type Meta } from "./api.js";
import { handleHide } from "./hide.js";
import { escapeHtml, simplePage } from "./html.js";
import { loadPageData } from "./pageData.js";
import type { Reply } from "./reply.js";
import { asset, indexPage } from "./staticFiles.js";

const PAGE_SIZE = 100;
const API_PREFIX = "/api/";
const ASSET_PREFIX = "/assets/";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const NOT_FOUND: Reply = { status: 404, body: simplePage("Not found") };

export interface UiState {
  config: FileConfig;
  views: JobViews;
  dbPath: string;
}

interface UiDeps {
  state: () => UiState;
  now: () => Date;
  clientDir: string;
}

/** Creates the HTTP server that serves the React app, its JSON API and the hide form. */
export function createUiServer(deps: UiDeps): Server {
  return createServer((request, response) => {
    void respond(request, deps).then((reply) => send(response, reply));
  });
}

/** Routes a request to its handler, converting any thrown error into a 500 error page. */
async function respond(request: IncomingMessage, deps: UiDeps): Promise<Reply> {
  try {
    return await route(request, deps);
  } catch (error) {
    return { status: 500, body: simplePage(`Something went wrong: ${escapeHtml(describeError(error))}`) };
  }
}

/** Dispatches a request to the hide form, the JSON API, a built asset or the app's page, or answers 404/405. */
async function route(request: IncomingMessage, deps: UiDeps): Promise<Reply> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "POST" && url.pathname === "/hide") return handleHide(request, deps.state().views);
  if (request.method !== "GET") return { status: 405, body: simplePage("Method not allowed") };
  if (url.pathname === "/") return { status: 302, body: "", headers: { location: "/recommended" } };
  if (url.pathname.startsWith(API_PREFIX)) return apiReply(url, deps);
  if (url.pathname.startsWith(ASSET_PREFIX)) return (await asset(deps.clientDir, url.pathname.slice(ASSET_PREFIX.length))) ?? NOT_FOUND;
  return PAGES.some((page) => page.path === url.pathname) ? indexPage(deps.clientDir) : NOT_FOUND;
}

/** Answers a JSON API request, turning any failure into a JSON 500 carrying the error message. */
function apiReply(url: URL, deps: UiDeps): Reply {
  try {
    return apiRoute(url, deps);
  } catch (error) {
    return json(500, { error: describeError(error) });
  }
}

/** Routes a JSON API request to the footer metadata or a page of display-ready rows. */
function apiRoute(url: URL, deps: UiDeps): Reply {
  if (url.pathname === `${API_PREFIX}meta`) return json(200, meta(deps.state(), deps.now()));
  const name = PAGE_NAMES.find((candidate) => url.pathname === `${API_PREFIX}pages/${candidate}`);
  if (!name) return json(404, { error: "Not found" });
  const { views, config } = deps.state();
  const page = { offset: parseOffset(url.searchParams.get("offset")), limit: PAGE_SIZE };
  return json(200, loadPageData(name, { views, config, page, now: deps.now() }));
}

/** Describes the database being shown and when the server answered, for the page footer. */
function meta(state: UiState, now: Date): Meta {
  return { dbPath: state.dbPath, renderedAt: now.toISOString() };
}

/** Builds an uncached JSON reply. */
function json(status: number, body: unknown): Reply {
  return { status, body: JSON.stringify(body), headers: JSON_HEADERS };
}

/** Parses the offset query parameter, defaulting to 0 for missing or invalid values. */
function parseOffset(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** Writes a Reply's status, headers and body to the HTTP response. */
function send(response: ServerResponse, reply: Reply): void {
  response.writeHead(reply.status, { "content-type": "text/html; charset=utf-8", ...reply.headers });
  response.end(reply.body);
}

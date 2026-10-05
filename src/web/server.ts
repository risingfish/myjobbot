import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FileConfig } from "../config/schema.js";
import type { JobViews } from "../db/jobViews.js";
import { describeError } from "../errors.js";
import { handleHide } from "./hide.js";
import { escapeHtml } from "./html.js";
import { renderFragment, renderPage, simplePage } from "./page.js";
import type { Reply } from "./reply.js";
import { TABS, type Tab } from "./tabs.js";

const PAGE_SIZE = 100;
const ROWS_SUFFIX = /\/rows$/;

export interface UiState {
  config: FileConfig;
  views: JobViews;
  dbPath: string;
}

interface UiDeps {
  state: () => UiState;
  now: () => Date;
}

export function createUiServer(deps: UiDeps): Server {
  return createServer((request, response) => {
    void respond(request, deps).then((reply) => send(response, reply));
  });
}

async function respond(request: IncomingMessage, deps: UiDeps): Promise<Reply> {
  try {
    return await route(request, deps);
  } catch (error) {
    return { status: 500, body: simplePage(`Something went wrong: ${escapeHtml(describeError(error))}`) };
  }
}

async function route(request: IncomingMessage, deps: UiDeps): Promise<Reply> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "POST" && url.pathname === "/hide") return handleHide(request, deps.state().views);
  if (request.method !== "GET") return { status: 405, body: simplePage("Method not allowed") };
  if (url.pathname === "/") return { status: 302, body: "", headers: { location: "/recommended" } };
  const tab = TABS.find((candidate) => candidate.path === url.pathname.replace(ROWS_SUFFIX, ""));
  if (!tab) return { status: 404, body: simplePage("Not found") };
  return { status: 200, body: renderTab(tab, url, deps) };
}

function renderTab(tab: Tab, url: URL, deps: UiDeps): string {
  const state = deps.state();
  const page = { offset: parseOffset(url.searchParams.get("offset")), limit: PAGE_SIZE };
  const data = tab.load({ views: state.views, config: state.config, page, now: deps.now() });
  if (ROWS_SUFFIX.test(url.pathname)) return renderFragment(tab, data, page);
  return renderPage(tab, data, { page, footer: { dbPath: state.dbPath, renderedAt: deps.now() } });
}

function parseOffset(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function send(response: ServerResponse, reply: Reply): void {
  response.writeHead(reply.status, { "content-type": "text/html; charset=utf-8", ...reply.headers });
  response.end(reply.body);
}

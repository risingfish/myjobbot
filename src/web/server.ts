import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FileConfig } from "../config/schema.js";
import type { JobViews } from "../db/jobViews.js";
import { describeError } from "../errors.js";
import { escapeHtml } from "./html.js";
import { renderFragment, renderPage, simplePage } from "./page.js";
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

interface Reply {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export function createUiServer(deps: UiDeps): Server {
  return createServer((request, response) => send(response, handle(request, deps)));
}

function handle(request: IncomingMessage, deps: UiDeps): Reply {
  if (request.method !== "GET") return { status: 405, body: simplePage("Method not allowed") };
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") return { status: 302, body: "", headers: { location: "/recommended" } };
  const tab = TABS.find((candidate) => candidate.path === url.pathname.replace(ROWS_SUFFIX, ""));
  if (!tab) return { status: 404, body: simplePage("Not found") };
  return safely(() => renderTab(tab, url, deps));
}

function renderTab(tab: Tab, url: URL, deps: UiDeps): string {
  const state = deps.state();
  const page = { offset: parseOffset(url.searchParams.get("offset")), limit: PAGE_SIZE };
  const data = tab.load({ views: state.views, config: state.config, page, now: deps.now() });
  if (ROWS_SUFFIX.test(url.pathname)) return renderFragment(tab, data, page);
  return renderPage(tab, data, { page, footer: { dbPath: state.dbPath, renderedAt: deps.now() } });
}

function safely(render: () => string): Reply {
  try {
    return { status: 200, body: render() };
  } catch (error) {
    return { status: 500, body: simplePage(`Something went wrong: ${escapeHtml(describeError(error))}`) };
  }
}

function parseOffset(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function send(response: ServerResponse, reply: Reply): void {
  response.writeHead(reply.status, { "content-type": "text/html; charset=utf-8", ...reply.headers });
  response.end(reply.body);
}

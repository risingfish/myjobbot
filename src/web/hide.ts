import type { IncomingMessage } from "node:http";
import { z } from "zod";
import type { JobViews } from "../db/jobViews.js";
import { simplePage } from "./page.js";
import type { Reply } from "./reply.js";
import { TABS } from "./tabs.js";

const MAX_BODY_CHARS = 4096;
const DEFAULT_BACK = "/recommended";
const SAME_SITE_FETCHES = new Set(["same-origin", "none"]);

const hideForm = z.object({
  ats: z.string().min(1),
  job_id: z.string().min(1),
  hidden: z.enum(["0", "1"]).transform((flag) => flag === "1"),
  back: z.string().refine((path) => TABS.some((tab) => tab.path === path)).catch(DEFAULT_BACK),
});

export async function handleHide(request: IncomingMessage, views: JobViews): Promise<Reply> {
  if (!isSameOrigin(request)) return message(403, "Forbidden: changes must come from this page.");
  const form = hideForm.safeParse(Object.fromEntries(new URLSearchParams(await readBody(request))));
  if (!form.success) return message(400, "Bad request.");
  const { ats, job_id: jobId, hidden, back } = form.data;
  if (!views.setHidden({ ats, jobId, hidden })) return message(404, "No such job.");
  if (request.headers["x-myjobbot-fetch"]) return { status: 204, body: "" };
  return { status: 303, body: "", headers: { location: back } };
}

function message(status: number, text: string): Reply {
  return { status, body: simplePage(text) };
}

function isSameOrigin(request: IncomingMessage): boolean {
  const site = request.headers["sec-fetch-site"];
  if (site !== undefined && !SAME_SITE_FETCHES.has(site)) return false;
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  return URL.canParse(origin) && new URL(origin).host === request.headers.host;
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > MAX_BODY_CHARS) throw new Error("request body too large");
  }
  return body;
}

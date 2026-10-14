import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Reply } from "./reply.js";

const ASSET_NAME = /^[\w-]+(\.[\w-]+)+$/;
const IMMUTABLE = "public, max-age=31536000, immutable";
const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Serves the built app's page, read on every request so a rebuild shows on the next reload. */
export async function indexPage(clientDir: string): Promise<Reply> {
  const body = await readFile(join(clientDir, "index.html"), "utf8");
  return { status: 200, body, headers: { "cache-control": "no-cache" } };
}

/** Serves one built file from the app's assets folder, or null when the name is not a plain asset file there. */
export async function asset(clientDir: string, name: string): Promise<Reply | null> {
  const type = TYPES[extname(name)];
  const file = join(clientDir, "assets", name);
  if (!ASSET_NAME.test(name) || type === undefined || !existsSync(file)) return null;
  return { status: 200, body: await readFile(file), headers: { "content-type": type, "cache-control": IMMUTABLE } };
}

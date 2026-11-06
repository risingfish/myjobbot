import { z } from "zod";
import { MESSAGES } from "../../accounts/messages.js";

type Env = Record<string, string | undefined>;

export type BaseUrl = { ok: true; url: URL; trustedProxies: number } | { ok: false; message: string };

const LOCAL_NAMES = new Set(["localhost", "127.0.0.1"]);

const settings = z.object({
    MYJOBBOT_BASE_URL: z.url(),
    MYJOBBOT_TRUSTED_PROXIES: z.coerce.number().int().min(0).max(10).default(0),
});

/** Returns the host:port names the UI answers to, from MYJOBBOT_HOSTS or the localhost defaults. */
export function allowedHosts(env: Env): string[] {
    const listed = env.MYJOBBOT_HOSTS;
    if (listed) return listed.split(",").map((name) => name.trim().toLowerCase());
    const port = env.MYJOBBOT_PORT ?? "8080";
    return [`localhost:${port}`, `127.0.0.1:${port}`];
}

/** Says whether an address can be the UI's public one: HTTPS or localhost, a bare origin, and a host the UI answers to. */
function usable(url: URL, env: Env): boolean {
    const scheme = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_NAMES.has(url.hostname));
    const bare = url.pathname === "/" && url.search === "" && url.hash === "";
    return scheme && bare && allowedHosts(env).includes(url.host);
}

/** Reads the UI's public address and the number of trusted proxies in front of it, refusing anything unsafe with a fixed message. */
export function parseBaseUrl(env: Env): BaseUrl {
    const parsed = settings.safeParse(env);
    if (!parsed.success) return { ok: false, message: MESSAGES.base_url };
    const url = new URL(parsed.data.MYJOBBOT_BASE_URL);
    return usable(url, env) ? { ok: true, url, trustedProxies: parsed.data.MYJOBBOT_TRUSTED_PROXIES } : { ok: false, message: MESSAGES.base_url };
}

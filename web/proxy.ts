import { NextResponse, type NextRequest } from "next/server.js";

/** Lets a request through only when its Host header names this UI, so other hostnames that resolve here are refused. */
export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host")?.toLowerCase();
  if (host && allowedHosts().includes(host)) return NextResponse.next();
  return new NextResponse("Misdirected Request", { status: 421 });
}

/** Returns the host:port names the UI answers to, from MYJOBBOT_HOSTS or the localhost defaults. */
function allowedHosts(): string[] {
  const listed = process.env.MYJOBBOT_HOSTS;
  if (listed) return listed.split(",").map((name) => name.trim().toLowerCase());
  const port = process.env.MYJOBBOT_PORT ?? "8080";
  return [`localhost:${port}`, `127.0.0.1:${port}`];
}

export const config = { matcher: "/:path*" };

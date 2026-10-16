import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Returns the host names the dev server's live reload should accept, taken from MYJOBBOT_HOSTS without their ports. */
function devOrigins(hosts: string | undefined): string[] {
    const names = (hosts ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase().replace(/:\d+$/, ""))
        .filter((name) => name !== "");
    return [...new Set(names)];
}

const nextConfig: NextConfig = {
    turbopack: { root: repoRoot },
    outputFileTracingRoot: repoRoot,
    poweredByHeader: false,
    agentRules: false,
    distDir: process.env.NEXT_DIST_DIR ?? ".next",
    allowedDevOrigins: devOrigins(process.env.MYJOBBOT_HOSTS),
};

export default nextConfig;

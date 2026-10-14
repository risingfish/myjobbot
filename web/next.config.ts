import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const nextConfig: NextConfig = {
    turbopack: { root: repoRoot },
    outputFileTracingRoot: repoRoot,
    poweredByHeader: false,
    agentRules: false,
    distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;

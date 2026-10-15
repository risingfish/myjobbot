import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            { test: { name: "node", include: ["tests/**/*.test.ts"], exclude: ["tests/integration/**"], environment: "node" } },
            {
                plugins: [react()],
                test: { name: "dom", include: ["tests/**/*.test.tsx"], environment: "happy-dom", setupFiles: ["tests/helpers/domSetup.ts"] },
            },
            { test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 } },
        ],
    },
});

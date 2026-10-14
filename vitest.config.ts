import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        projects: [
            { test: { name: "node", include: ["tests/**/*.test.ts"], environment: "node" } },
            {
                plugins: [react()],
                test: { name: "dom", include: ["tests/**/*.test.tsx"], environment: "happy-dom", setupFiles: ["tests/helpers/domSetup.ts"] },
            },
        ],
    },
});

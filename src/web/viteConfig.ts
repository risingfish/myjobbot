import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const forward = { target: "http://localhost:8080", changeOrigin: false };

export const viteConfig = defineConfig({
  root: fileURLToPath(new URL("./client", import.meta.url)),
  plugins: [react()],
  cacheDir: join(tmpdir(), "myjobbot-vite-cache"),
  logLevel: "warn",
  build: { outDir: join(tmpdir(), "myjobbot-client"), emptyOutDir: true },
  server: { host: "localhost", port: 5173, strictPort: true, proxy: { "/api": forward, "/hide": forward } },
});

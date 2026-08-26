import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: webRoot,
  server: {
    host: process.env.LIVING_REGION_HOST ?? "127.0.0.1",
    allowedHosts: ["localhost", "127.0.0.1", "::1", "zvorygin"],
    proxy: {
      "/api":
        process.env.CANVASS_API_URL ?? "http://127.0.0.1:4174",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: webRoot,
  server: {
    host: "::",
    allowedHosts: ["localhost", "127.0.0.1", "::1", "zvorygin"]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Pure .ts tests stay on fast node; .tsx component tests get a DOM.
    environment: "node",
    environmentMatchGlobs: [["src/**/*.{test,spec}.tsx", "jsdom"]],
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws on import outside a React Server Component build.
      // Server modules under test are plain functions, so it stubs out here.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});

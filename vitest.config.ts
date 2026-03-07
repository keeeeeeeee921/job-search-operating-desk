import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  }
});

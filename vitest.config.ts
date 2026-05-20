import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // PGlite WASM-Initialisierung ist zu schwer fuer parallele Worker-Forks
    // (mehrere Files schlagen sich gegenseitig im Hook-Timeout). Sequenziell
    // laufen lassen — alle DB-Tests teilen sich einen Worker und init.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

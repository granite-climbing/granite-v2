import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    // Match Next.js's automatic JSX runtime so components don't need `import React`.
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
    // Pin to the app's real timezone. D1 hands back timestamps without a zone
    // marker ("2026-07-22 03:04:05"), and code that forgets to force UTC still
    // looks correct under TZ=UTC — so a UTC CI runner would silently pass tests
    // that fail for real users. See lib/auth/withdrawal.ts.
    env: { TZ: "Asia/Seoul" },
  },
});

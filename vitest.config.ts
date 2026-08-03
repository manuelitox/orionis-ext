import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.types.ts",
        "src/background.ts",
        "src/sidepanel.ts",
        "src/types.ts"
      ],
      thresholds: {
        statements: 90,
        branches: 70,
        functions: 90,
        lines: 90
      }
    }
  }
});

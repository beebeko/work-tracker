import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: ["./src/test/setupTests.ts"],
        include: ["tests/f004/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["src/features/feature-governance/**/*.{ts,tsx}"],
            exclude: [
                "src/features/feature-governance/**/*.test.{ts,tsx}",
                "src/features/feature-governance/**/index.ts",
            ],
            lines: 95,
            functions: 95,
            branches: 95,
            statements: 95,
        },
    },
});

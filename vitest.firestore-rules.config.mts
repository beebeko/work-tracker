import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["tests/firestore/**/*.test.ts"],
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});

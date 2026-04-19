import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

// Polyfill crypto.randomUUID for Node.js environment
if (!globalThis.crypto) {
    const nodeCrypto = require("crypto");
    globalThis.crypto = {
        randomUUID: () => nodeCrypto.randomUUID(),
    } as any;
}

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

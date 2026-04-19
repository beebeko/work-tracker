/**
 * Data Layer Public API
 * Exports the singleton data layer instance and types
 */

import type { IDataLayer } from "./dal";
import { FirebaseDataLayer } from "./adapters/firebase.adapter";
import { JsonDataLayer } from "./adapters/json.adapter";

// Singleton instance
let dataLayerInstance: IDataLayer | null = null;
let didInitialize = false;

export function resolveDataAdapterMode(
    env: ImportMetaEnv = import.meta.env,
): "json" | "firebase" {
    const configuredAdapter =
        env.VITE_FREELANCE_DATA_ADAPTER?.trim().toLowerCase();

    return configuredAdapter === "firebase" ? "firebase" : "json";
}

export function isFirebaseAdapterEnabled(
    env: ImportMetaEnv = import.meta.env,
): boolean {
    return resolveDataAdapterMode(env) === "firebase";
}

function createDataLayer(adapter: "json" | "firebase"): IDataLayer {
    return adapter === "firebase"
        ? new FirebaseDataLayer()
        : new JsonDataLayer();
}

/**
 * Get or initialize the data layer singleton
 */
export function getDataLayer() {
    if (!dataLayerInstance) {
        dataLayerInstance = createDataLayer(resolveDataAdapterMode());
    }

    if (!didInitialize) {
        didInitialize = true;
        const initResultPromise = dataLayerInstance.initialize();
        void initResultPromise.then((initResult) => {
            if (!initResult.success) {
                console.error(
                    "Failed to initialize data layer. If you enabled Firebase via VITE_FREELANCE_DATA_ADAPTER=firebase, verify Firebase env vars and anonymous auth bootstrap are configured:",
                    initResult.error,
                );
            }
        });
    }

    return dataLayerInstance;
}

// Re-export types and interfaces
export type { IDataLayer, ITransactionContext } from "./dal";
export { JsonDataLayer } from "./adapters/json.adapter";
export { FirebaseDataLayer } from "./adapters/firebase.adapter";

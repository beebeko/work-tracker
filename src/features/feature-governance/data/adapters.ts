import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import type {
    FeatureMetadataDocument,
    FeatureGovernanceResult,
} from "../contracts/types";
import { governanceOk, governanceErr } from "../contracts/types";
import type { IFeatureMetadataRepository } from "./dal";

/**
 * JSON file adapter: reads canonical feature metadata from data/store/feature-metadata.json
 * Implements IFeatureMetadataRepository for use with RunRoutingPipeline.
 */
export class JsonFileMetadataRepository implements IFeatureMetadataRepository {
    private metadataPath: string;

    constructor(metadataPath?: string) {
        if (metadataPath) {
            this.metadataPath = metadataPath;
        } else {
            // Default: resolve relative to project root
            // From TypeScript file at src/features/feature-governance/data/
            // Go up to project root
            const currentDir = process.cwd();
            this.metadataPath = join(currentDir, "data/store/feature-metadata.json");
        }
    }

    async getCanonicalMetadata(): Promise<FeatureGovernanceResult<FeatureMetadataDocument>> {
        try {
            const content = await readFile(this.metadataPath, "utf-8");
            const doc: FeatureMetadataDocument = JSON.parse(content);

            // Basic validation
            if (!doc.schemaVersion || !Array.isArray(doc.features)) {
                return governanceErr({
                    type: "validation",
                    message: "Invalid feature metadata document structure",
                });
            }

            return governanceOk(doc);
        } catch (cause) {
            if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") {
                return governanceErr({
                    type: "notFound",
                    message: `Metadata file not found: ${this.metadataPath}`,
                });
            }

            return governanceErr({
                type: "io",
                message: `Failed to read metadata file: ${cause instanceof Error ? cause.message : String(cause)}`,
                cause: cause instanceof Error ? cause : undefined,
            });
        }
    }
}

/**
 * In-memory adapter for testing purposes.
 * Allows tests to provide metadata directly without file I/O.
 */
export class InMemoryMetadataRepository implements IFeatureMetadataRepository {
    constructor(private metadata: FeatureMetadataDocument) {}

    async getCanonicalMetadata(): Promise<FeatureGovernanceResult<FeatureMetadataDocument>> {
        return governanceOk(this.metadata);
    }
}

import type { IFeatureMetadataRepository } from "../data/dal";
import type { FeatureGovernanceResult } from "../contracts/types";
import { governanceOk, governanceErr } from "../contracts/types";
import { SemverEngine } from "../domain/SemverEngine";
import { TemplateGenerator } from "../domain/TemplateGenerator";
import { ParityChecker } from "../domain/ParityChecker";
import type { CommitTemplatePayload } from "../domain/TemplateGenerator";
import type { ParityCheckReport } from "../domain/ParityChecker";

/**
 * Pipeline result: contains generated artifacts and validation reports.
 */
export type PipelineResult = {
    version: string;
    templatePayload: CommitTemplatePayload;
    parityReport: ParityCheckReport;
};

/**
 * Orchestration pipeline: sequences semver -> template -> parity checks.
 * Ensures deterministic artifact generation with full consistency validation.
 *
 * Flow:
 * 1. Load canonical metadata from repository
 * 2. Derive next semver from current version
 * 3. Generate template payload with embedded digest
 * 4. Validate template payload
 * 5. Check parity between source and payload
 * 6. Return combined results or fail fast on any error
 */
export class RunRoutingPipeline {
    constructor(
        private metadataRepository: IFeatureMetadataRepository,
        private currentVersion: string,
        private oldMetadata?: any, // For comparison in version derivation
    ) {}

    /**
     * Execute the full pipeline: load metadata, derive version, generate template, check parity.
     */
    async execute(): Promise<FeatureGovernanceResult<PipelineResult>> {
        // Step 1: Load canonical metadata
        const metadataResult = await this.metadataRepository.getCanonicalMetadata();
        if (!metadataResult.success) {
            return governanceErr({
                type: "io",
                message: "Failed to load canonical metadata",
            });
        }

        const newMetadata = metadataResult.data;

        // Step 2: Derive next semver
        let nextVersion = this.currentVersion;
        if (this.oldMetadata) {
            try {
                const engine = new SemverEngine(this.currentVersion);
                const nextSemver = engine.deriveNextVersion(this.oldMetadata, newMetadata);
                nextVersion = `${nextSemver.major}.${nextSemver.minor}.${nextSemver.patch}`;
            } catch (error) {
                return governanceErr({
                    type: "validation",
                    message: `Failed to derive next version: ${error instanceof Error ? error.message : String(error)}`,
                });
            }
        }

        // Step 3: Generate template payload
        const generator = new TemplateGenerator();
        const templateResult = generator.generateTemplatePayload(newMetadata, nextVersion);
        if (!templateResult.success) {
            return governanceErr({
                type: "io",
                message: "Failed to generate template payload",
            });
        }

        const payload = templateResult.data;

        // Step 4: Validate template payload
        const payloadValidation = generator.validatePayload(payload);
        if (!payloadValidation.success) {
            return governanceErr({
                type: "validation",
                message: `Template payload validation failed: ${payloadValidation.error.message}`,
            });
        }

        // Step 5: Check parity
        const checker = new ParityChecker();
        const parityResult = checker.checkParityResult(newMetadata, payload);
        if (!parityResult.success) {
            return governanceErr({
                type: "validation",
                message: `Parity check failed: ${parityResult.error.message}`,
            });
        }

        // Step 6: Return combined results
        return governanceOk({
            version: nextVersion,
            templatePayload: payload,
            parityReport: parityResult.data,
        });
    }

    /**
     * Execute pipeline and return structured error JSON on failure.
     * Used by CLI to emit machine-readable diagnostics.
     */
    async executeWithErrorOutput(): Promise<{
        success: boolean;
        data?: PipelineResult;
        error?: {
            code: string;
            message: string;
        };
    }> {
        const result = await this.execute();

        if (result.success) {
            return {
                success: true,
                data: result.data,
            };
        }

        return {
            success: false,
            error: {
                code: result.error.type,
                message: result.error.message,
            },
        };
    }
}

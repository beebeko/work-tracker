import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { RunRoutingPipeline } from "../../src/features/feature-governance/application/RunRoutingPipeline";
import { JsonFileMetadataRepository } from "../../src/features/feature-governance/data/adapters";
import { ParityChecker } from "../../src/features/feature-governance/domain/ParityChecker";
import { TemplateGenerator } from "../../src/features/feature-governance/domain/TemplateGenerator";

/**
 * CLI handlers for F-004 Feature Governance commands
 */

export type CliResult = {
    success: boolean;
    exitCode: number;
    output: string;
};

/**
 * Generate commit template from canonical metadata
 */
export async function handleGenerate(): Promise<CliResult> {
    try {
        const metadataPath = join(process.cwd(), "data/store/feature-metadata.json");
        const repository = new JsonFileMetadataRepository(metadataPath);

        // Get current version from metadata
        const metadataResult = await repository.getCanonicalMetadata();
        if (!metadataResult.success) {
            return {
                success: false,
                exitCode: 1,
                output: JSON.stringify({
                    error: {
                        code: metadataResult.error.type,
                        message: metadataResult.error.message,
                    },
                }, null, 2),
            };
        }

        const metadata = metadataResult.data;
        const currentVersion = metadata.migration?.sourceDigestSha256 ? "1.0.1" : "1.0.0";

        // Generate template
        const generator = new TemplateGenerator();
        const templateResult = generator.generateTemplatePayload(metadata, currentVersion);
        if (!templateResult.success) {
            return {
                success: false,
                exitCode: 2,
                output: JSON.stringify({
                    error: {
                        code: "VALIDATION",
                        message: templateResult.error.message,
                    },
                }, null, 2),
            };
        }

        return {
            success: true,
            exitCode: 0,
            output: JSON.stringify({
                status: "success",
                data: templateResult.data,
            }, null, 2),
        };
    } catch (error) {
        return {
            success: false,
            exitCode: 1,
            output: JSON.stringify({
                error: {
                    code: "IO_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                },
            }, null, 2),
        };
    }
}

/**
 * Check parity between metadata and template
 */
export async function handleParity(): Promise<CliResult> {
    try {
        const metadataPath = join(process.cwd(), "data/store/feature-metadata.json");
        const repository = new JsonFileMetadataRepository(metadataPath);

        const metadataResult = await repository.getCanonicalMetadata();
        if (!metadataResult.success) {
            return {
                success: false,
                exitCode: 1,
                output: JSON.stringify({
                    error: {
                        code: metadataResult.error.type,
                        message: metadataResult.error.message,
                    },
                }, null, 2),
            };
        }

        // Generate template for current state
        const metadata = metadataResult.data;
        const currentVersion = "1.0.0";
        const generator = new TemplateGenerator();
        const templateResult = generator.generateTemplatePayload(metadata, currentVersion);
        if (!templateResult.success) {
            return {
                success: false,
                exitCode: 2,
                output: JSON.stringify({
                    error: {
                        code: "VALIDATION",
                        message: templateResult.error.message,
                    },
                }, null, 2),
            };
        }

        // Check parity
        const checker = new ParityChecker();
        const report = checker.checkParity(metadata, templateResult.data);

        const exitCode = report.status === "pass" ? 0 : 2;
        return {
            success: report.status === "pass",
            exitCode,
            output: JSON.stringify({
                status: report.status,
                data: report,
            }, null, 2),
        };
    } catch (error) {
        return {
            success: false,
            exitCode: 1,
            output: JSON.stringify({
                error: {
                    code: "IO_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                },
            }, null, 2),
        };
    }
}

/**
 * Full verification pipeline
 */
export async function handleVerify(): Promise<CliResult> {
    try {
        const metadataPath = join(process.cwd(), "data/store/feature-metadata.json");
        const repository = new JsonFileMetadataRepository(metadataPath);
        const pipeline = new RunRoutingPipeline(repository, "1.0.0");
        const result = await pipeline.executeWithErrorOutput();

        const exitCode = result.success ? 0 : 2;
        return {
            success: result.success,
            exitCode,
            output: JSON.stringify(result, null, 2),
        };
    } catch (error) {
        return {
            success: false,
            exitCode: 1,
            output: JSON.stringify({
                success: false,
                error: {
                    code: "IO_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                },
            }, null, 2),
        };
    }
}

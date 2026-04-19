import { createHash } from "crypto";
import type { FeatureMetadataDocument } from "../contracts/types";
import { governanceOk, governanceErr } from "../contracts/types";
import type { FeatureGovernanceResult } from "../contracts/types";

/**
 * Commit message template payload with embedded source digest.
 * This is the artifact that will be enforced by the parity checker.
 */
export type CommitTemplatePayload = {
    template: {
        version: string;
        generatedAt: string; // ISO 8601
        sourceDigestSha256: string;
    };
    features: Array<{
        featureId: string;
        name: string;
        status: string;
    }>;
};

/**
 * Compute SHA256 digest of a metadata document.
 * This digest is embedded in all generated artifacts for parity validation.
 */
export function computeSourceDigest(doc: FeatureMetadataDocument): string {
    const canonical = JSON.stringify(doc, null, 0); // Minimize to single line
    return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Template generator: creates mandatory commit message template artifacts
 * with required fields and embedded sourceDigestSha256.
 */
export class TemplateGenerator {
    /**
     * Generate commit template payload from metadata document.
     * Embeds sourceDigestSha256 for parity enforcement.
     */
    generateTemplatePayload(
        doc: FeatureMetadataDocument,
        version: string,
    ): FeatureGovernanceResult<CommitTemplatePayload> {
        try {
            const digest = computeSourceDigest(doc);

            const payload: CommitTemplatePayload = {
                template: {
                    version,
                    generatedAt: new Date().toISOString(),
                    sourceDigestSha256: digest,
                },
                features: doc.features.map((f) => ({
                    featureId: f.featureId,
                    name: f.name,
                    status: f.status,
                })),
            };

            return governanceOk(payload);
        } catch (cause) {
            return governanceErr({
                type: "io",
                message: "Failed to generate template payload",
                cause: cause instanceof Error ? cause : undefined,
            });
        }
    }

    /**
     * Generate formatted commit message body for use in prepare-commit-msg hook.
     * This is a human-readable representation of the template payload.
     */
    generateCommitMessageBody(payload: CommitTemplatePayload): string {
        const header = `F-004 Feature Governance Commit [v${payload.template.version}]`;
        const divider = "---";
        const digestLine = `Source-Digest: ${payload.template.sourceDigestSha256}`;
        const featureSummary = payload.features
            .map((f) => `  - ${f.featureId}: ${f.name} (${f.status})`)
            .join("\n");

        return [header, divider, digestLine, "", "Features:", featureSummary, ""].join("\n");
    }

    /**
     * Verify that a payload has required fields (for validation before persistence).
     */
    validatePayload(payload: CommitTemplatePayload): FeatureGovernanceResult<void> {
        // Check for null/undefined payload
        if (!payload || typeof payload !== "object") {
            return governanceErr({
                type: "validation",
                message: "Payload must be a valid object",
                field: "payload",
            });
        }

        // Check template fields
        if (!payload.template.version) {
            return governanceErr({
                type: "validation",
                message: "Missing template.version",
                field: "template.version",
            });
        }

        if (!payload.template.generatedAt) {
            return governanceErr({
                type: "validation",
                message: "Missing template.generatedAt",
                field: "template.generatedAt",
            });
        }

        if (!payload.template.sourceDigestSha256) {
            return governanceErr({
                type: "validation",
                message: "Missing template.sourceDigestSha256",
                field: "template.sourceDigestSha256",
            });
        }

        // Check that sourceDigestSha256 is valid hex string (64 chars for SHA256)
        if (!/^[a-f0-9]{64}$/.test(payload.template.sourceDigestSha256)) {
            return governanceErr({
                type: "validation",
                message: "Invalid sourceDigestSha256 format (expected 64-char hex)",
                field: "template.sourceDigestSha256",
            });
        }

        // Check features array
        if (!Array.isArray(payload.features) || payload.features.length === 0) {
            return governanceErr({
                type: "validation",
                message: "Features array must not be empty",
                field: "features",
            });
        }

        // Validate each feature
        for (const feature of payload.features) {
            if (!feature.featureId) {
                return governanceErr({
                    type: "validation",
                    message: "Feature missing featureId",
                    field: "features[].featureId",
                });
            }
            if (!feature.name) {
                return governanceErr({
                    type: "validation",
                    message: "Feature missing name",
                    field: "features[].name",
                });
            }
            if (!feature.status) {
                return governanceErr({
                    type: "validation",
                    message: "Feature missing status",
                    field: "features[].status",
                });
            }
        }

        return governanceOk(undefined);
    }
}

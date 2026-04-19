import type { FeatureMetadataDocument } from "../contracts/types";
import { governanceOk, governanceErr } from "../contracts/types";
import type { FeatureGovernanceResult } from "../contracts/types";
import { computeSourceDigest } from "./TemplateGenerator";
import type { CommitTemplatePayload } from "./TemplateGenerator";

/**
 * Parity report: documents consistency check results between source metadata and template payload.
 * Used as JSON output for CI/CLI diagnostics.
 */
export type ParityCheckReport = {
    status: "pass" | "fail";
    timestamp: string; // ISO 8601
    sourceDigest: string;
    payloadDigest: string;
    featureCount: {
        source: number;
        payload: number;
        match: boolean;
    };
    details: Array<{
        check: string;
        pass: boolean;
        details?: string;
    }>;
    errors: Array<{
        code: string;
        message: string;
    }>;
};

/**
 * Parity checker: validates digest consistency between canonical metadata and generated artifacts.
 * Ensures that commit templates accurately reflect the source metadata state.
 */
export class ParityChecker {
    /**
     * Compare source metadata digest with payload digest.
     * Returns true if digests match (metadata and payload are in sync).
     */
    verifyDigestParity(
        sourceDoc: FeatureMetadataDocument,
        payload: CommitTemplatePayload,
    ): boolean {
        const sourceDigest = computeSourceDigest(sourceDoc);
        const payloadDigest = payload.template.sourceDigestSha256;
        return sourceDigest === payloadDigest;
    }

    /**
     * Check that feature count in payload matches source.
     */
    verifyFeatureCountParity(
        sourceDoc: FeatureMetadataDocument,
        payload: CommitTemplatePayload,
    ): boolean {
        return sourceDoc.features.length === payload.features.length;
    }

    /**
     * Check that feature IDs in payload match source (order-sensitive).
     */
    verifyFeatureIdParity(
        sourceDoc: FeatureMetadataDocument,
        payload: CommitTemplatePayload,
    ): boolean {
        if (sourceDoc.features.length !== payload.features.length) {
            return false;
        }

        for (let i = 0; i < sourceDoc.features.length; i++) {
            if (sourceDoc.features[i].featureId !== payload.features[i].featureId) {
                return false;
            }
        }

        return true;
    }

    /**
     * Run comprehensive parity check and generate detailed report.
     * Report includes all checks, pass/fail status, and any discovered inconsistencies.
     */
    checkParity(
        sourceDoc: FeatureMetadataDocument,
        payload: CommitTemplatePayload,
    ): ParityCheckReport {
        const checks = [];
        const errors = [];

        // Digest parity
        const digestMatch = this.verifyDigestParity(sourceDoc, payload);
        checks.push({
            check: "sourceDigestSha256 parity",
            pass: digestMatch,
            details: digestMatch ? "Digests match" : "Digest mismatch: source and payload out of sync",
        });

        if (!digestMatch) {
            errors.push({
                code: "DIGEST_MISMATCH",
                message: "Source metadata digest does not match payload digest. Regenerate template.",
            });
        }

        // Feature count parity
        const countMatch = this.verifyFeatureCountParity(sourceDoc, payload);
        checks.push({
            check: "feature count parity",
            pass: countMatch,
            details: countMatch
                ? `Both have ${sourceDoc.features.length} features`
                : `Count mismatch: source=${sourceDoc.features.length}, payload=${payload.features.length}`,
        });

        if (!countMatch) {
            errors.push({
                code: "FEATURE_COUNT_MISMATCH",
                message: "Feature count in payload does not match source. Regenerate template.",
            });
        }

        // Feature ID parity
        const idMatch = this.verifyFeatureIdParity(sourceDoc, payload);
        checks.push({
            check: "feature ID order parity",
            pass: idMatch,
            details: idMatch ? "All feature IDs match in order" : "Feature ID mismatch or reordering detected",
        });

        if (!idMatch) {
            errors.push({
                code: "FEATURE_ID_MISMATCH",
                message: "Feature IDs in payload do not match source order. Regenerate template.",
            });
        }

        // Overall pass/fail
        const allPass = checks.every((c) => c.pass);

        return {
            status: allPass ? "pass" : "fail",
            timestamp: new Date().toISOString(),
            sourceDigest: computeSourceDigest(sourceDoc),
            payloadDigest: payload.template.sourceDigestSha256,
            featureCount: {
                source: sourceDoc.features.length,
                payload: payload.features.length,
                match: countMatch,
            },
            details: checks,
            errors,
        };
    }

    /**
     * Check parity and return as FeatureGovernanceResult.
     * Used in orchestration to integrate with error handling.
     */
    checkParityResult(
        sourceDoc: FeatureMetadataDocument,
        payload: CommitTemplatePayload,
    ): FeatureGovernanceResult<ParityCheckReport> {
        const report = this.checkParity(sourceDoc, payload);

        if (report.status === "fail") {
            return governanceErr({
                type: "validation",
                message: `Parity check failed: ${report.errors.map((e) => e.message).join("; ")}`,
            });
        }

        return governanceOk(report);
    }
}

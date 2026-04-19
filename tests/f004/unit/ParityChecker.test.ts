import { describe, it, expect } from "vitest";
import { ParityChecker } from "../../../src/features/feature-governance/domain/ParityChecker";
import { TemplateGenerator } from "../../../src/features/feature-governance/domain/TemplateGenerator";
import type { FeatureMetadataDocument } from "../../../src/features/feature-governance/contracts/types";
import type { CommitTemplatePayload } from "../../../src/features/feature-governance/domain/TemplateGenerator";

describe("ParityChecker", () => {
    const baseMetadataDoc: FeatureMetadataDocument = {
        schemaVersion: "1.0",
        lastUpdated: "2026-04-19",
        projection: {
            markdownRegistryPath: "docs/features/registry.md",
            policy: "projection-only",
        },
        features: [
            {
                featureId: "F-001",
                name: "Freelance Hours Tracker",
                status: "active",
                owner: "data-management",
                summary: "Track freelance work hours",
                classification: "new-sensible",
                confidence: 0.95,
                scope: {
                    includes: ["entry form"],
                    excludes: ["multi-device sync"],
                },
            },
            {
                featureId: "F-004",
                name: "Feature Governance Automation",
                status: "planned",
                owner: "testing-agent",
                summary: "Automate feature registry governance",
                classification: "new-sensible",
                confidence: 0.96,
                scope: {
                    includes: ["canonical metadata"],
                    excludes: ["changing classification"],
                },
            },
        ],
    };

    describe("verifyDigestParity", () => {
        it("should verify matching digests", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const match = checker.verifyDigestParity(baseMetadataDoc, payloadResult.data);
                expect(match).toBe(true);
            }
        });

        it("should detect mismatched digests", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                // Tamper with payload digest
                const tamperedPayload = {
                    ...payloadResult.data,
                    template: {
                        ...payloadResult.data.template,
                        sourceDigestSha256: "0000000000000000000000000000000000000000000000000000000000000000",
                    },
                };
                const match = checker.verifyDigestParity(baseMetadataDoc, tamperedPayload);
                expect(match).toBe(false);
            }
        });

        it("should detect digest mismatch when metadata changes", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const modifiedMetadata = {
                    ...baseMetadataDoc,
                    lastUpdated: "2026-04-20",
                };
                const match = checker.verifyDigestParity(modifiedMetadata, payloadResult.data);
                expect(match).toBe(false);
            }
        });
    });

    describe("verifyFeatureCountParity", () => {
        it("should verify matching feature counts", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const match = checker.verifyFeatureCountParity(baseMetadataDoc, payloadResult.data);
                expect(match).toBe(true);
            }
        });

        it("should detect feature count mismatch", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const modifiedMetadata = {
                    ...baseMetadataDoc,
                    features: [...baseMetadataDoc.features, baseMetadataDoc.features[0]],
                };
                const match = checker.verifyFeatureCountParity(modifiedMetadata, payloadResult.data);
                expect(match).toBe(false);
            }
        });

        it("should handle empty feature lists", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const emptyMetadata: FeatureMetadataDocument = {
                ...baseMetadataDoc,
                features: [],
            };
            const payloadResult = generator.generateTemplatePayload(emptyMetadata, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const match = checker.verifyFeatureCountParity(emptyMetadata, payloadResult.data);
                expect(match).toBe(true);
            }
        });
    });

    describe("verifyFeatureIdParity", () => {
        it("should verify matching feature IDs", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const match = checker.verifyFeatureIdParity(baseMetadataDoc, payloadResult.data);
                expect(match).toBe(true);
            }
        });

        it("should be order-sensitive", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const reorderedMetadata = {
                    ...baseMetadataDoc,
                    features: [baseMetadataDoc.features[1], baseMetadataDoc.features[0]],
                };
                const match = checker.verifyFeatureIdParity(reorderedMetadata, payloadResult.data);
                expect(match).toBe(false);
            }
        });

        it("should detect missing feature ID", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const reducedMetadata = {
                    ...baseMetadataDoc,
                    features: [baseMetadataDoc.features[0]],
                };
                const match = checker.verifyFeatureIdParity(reducedMetadata, payloadResult.data);
                expect(match).toBe(false);
            }
        });

        it("should handle empty feature lists", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const emptyMetadata: FeatureMetadataDocument = {
                ...baseMetadataDoc,
                features: [],
            };
            const payloadResult = generator.generateTemplatePayload(emptyMetadata, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const match = checker.verifyFeatureIdParity(emptyMetadata, payloadResult.data);
                expect(match).toBe(true);
            }
        });
    });

    describe("checkParity", () => {
        it("should pass all checks for matching metadata and payload", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const report = checker.checkParity(baseMetadataDoc, payloadResult.data);
                expect(report.status).toBe("pass");
                expect(report.errors.length).toBe(0);
                expect(report.details.every((d) => d.pass)).toBe(true);
            }
        });

        it("should report digest mismatch", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const tamperedPayload = {
                    ...payloadResult.data,
                    template: {
                        ...payloadResult.data.template,
                        sourceDigestSha256: "0000000000000000000000000000000000000000000000000000000000000000",
                    },
                };
                const report = checker.checkParity(baseMetadataDoc, tamperedPayload);
                expect(report.status).toBe("fail");
                const digestCheck = report.details.find((d) => d.check === "sourceDigestSha256 parity");
                expect(digestCheck?.pass).toBe(false);
            }
        });

        it("should report feature count mismatch", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const modifiedMetadata = {
                    ...baseMetadataDoc,
                    features: [baseMetadataDoc.features[0]],
                };
                const report = checker.checkParity(modifiedMetadata, payloadResult.data);
                expect(report.status).toBe("fail");
            }
        });

        it("should include timestamp in report", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const report = checker.checkParity(baseMetadataDoc, payloadResult.data);
                expect(report.timestamp).toBeTruthy();
                expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
            }
        });

        it("should include all check types in report", () => {
            const generator = new TemplateGenerator();
            const checker = new ParityChecker();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const report = checker.checkParity(baseMetadataDoc, payloadResult.data);
                const checkNames = report.details.map((d) => d.check);
                expect(checkNames).toContain("sourceDigestSha256 parity");
                expect(checkNames).toContain("feature count parity");
                expect(checkNames).toContain("feature ID order parity");
            }
        });
    });
});

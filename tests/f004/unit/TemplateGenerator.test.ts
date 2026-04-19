import { describe, it, expect } from "vitest";
import { TemplateGenerator, computeSourceDigest } from "../../../src/features/feature-governance/domain/TemplateGenerator";
import type { FeatureMetadataDocument } from "../../../src/features/feature-governance/contracts/types";

describe("TemplateGenerator", () => {
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
                    includes: ["canonical metadata", "markdown projection"],
                    excludes: ["changing classification policy"],
                },
            },
        ],
    };

    describe("computeSourceDigest", () => {
        it("should compute stable SHA256 digest for metadata document", () => {
            const digest = computeSourceDigest(baseMetadataDoc);
            expect(digest).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
        });

        it("should produce deterministic digests for same document", () => {
            const digest1 = computeSourceDigest(baseMetadataDoc);
            const digest2 = computeSourceDigest(baseMetadataDoc);
            expect(digest1).toBe(digest2);
        });

        it("should produce different digest when document changes", () => {
            const digest1 = computeSourceDigest(baseMetadataDoc);
            const modifiedDoc = {
                ...baseMetadataDoc,
                lastUpdated: "2026-04-20",
            };
            const digest2 = computeSourceDigest(modifiedDoc);
            expect(digest1).not.toBe(digest2);
        });

        it("should handle empty feature list", () => {
            const emptyDoc: FeatureMetadataDocument = {
                ...baseMetadataDoc,
                features: [],
            };
            const digest = computeSourceDigest(emptyDoc);
            expect(digest).toMatch(/^[a-f0-9]{64}$/);
        });

        it("should be sensitive to feature order", () => {
            const digest1 = computeSourceDigest(baseMetadataDoc);
            const reorderedDoc = {
                ...baseMetadataDoc,
                features: [baseMetadataDoc.features[1], baseMetadataDoc.features[0]],
            };
            const digest2 = computeSourceDigest(reorderedDoc);
            expect(digest1).not.toBe(digest2);
        });
    });

    describe("TemplateGenerator.generateTemplatePayload", () => {
        it("should generate valid template payload", () => {
            const generator = new TemplateGenerator();
            const result = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.template.version).toBe("1.0.0");
                expect(result.data.template.sourceDigestSha256).toMatch(/^[a-f0-9]{64}$/);
                expect(result.data.template.generatedAt).toBeTruthy();
                expect(new Date(result.data.template.generatedAt).getTime()).toBeGreaterThan(0);
            }
        });

        it("should embed correct feature count in payload", () => {
            const generator = new TemplateGenerator();
            const result = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features.length).toBe(2);
                expect(result.data.features[0].featureId).toBe("F-001");
                expect(result.data.features[1].featureId).toBe("F-004");
            }
        });

        it("should include feature metadata in payload", () => {
            const generator = new TemplateGenerator();
            const result = generator.generateTemplatePayload(baseMetadataDoc, "2.1.0");
            expect(result.success).toBe(true);
            if (result.success) {
                const f001 = result.data.features.find((f) => f.featureId === "F-001");
                expect(f001).toEqual({
                    featureId: "F-001",
                    name: "Freelance Hours Tracker",
                    status: "active",
                });
            }
        });

        it("should produce deterministic payload for same input", () => {
            const generator = new TemplateGenerator();
            const result1 = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            const result2 = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(result1.success && result2.success).toBe(true);
            if (result1.success && result2.success) {
                expect(result1.data.template.sourceDigestSha256).toBe(
                    result2.data.template.sourceDigestSha256,
                );
            }
        });

        it("should handle empty feature list", () => {
            const generator = new TemplateGenerator();
            const emptyDoc: FeatureMetadataDocument = {
                ...baseMetadataDoc,
                features: [],
            };
            const result = generator.generateTemplatePayload(emptyDoc, "1.0.0");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features.length).toBe(0);
            }
        });
    });

    describe("TemplateGenerator.generateCommitMessageBody", () => {
        it("should generate properly formatted commit message", () => {
            const generator = new TemplateGenerator();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.2.3");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const body = generator.generateCommitMessageBody(payloadResult.data);
                expect(body).toContain("F-004 Feature Governance Commit");
                expect(body).toContain("[v1.2.3]");
                expect(body).toContain("Source-Digest:");
                expect(body).toContain("Features:");
                expect(body).toContain("F-001");
                expect(body).toContain("F-004");
            }
        });

        it("should include all feature entries", () => {
            const generator = new TemplateGenerator();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const body = generator.generateCommitMessageBody(payloadResult.data);
                expect(body).toContain("F-001: Freelance Hours Tracker (active)");
                expect(body).toContain("F-004: Feature Governance Automation (planned)");
            }
        });

        it("should include source digest from payload", () => {
            const generator = new TemplateGenerator();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const body = generator.generateCommitMessageBody(payloadResult.data);
                expect(body).toContain(payloadResult.data.template.sourceDigestSha256);
            }
        });
    });

    describe("TemplateGenerator.validatePayload", () => {
        it("should validate correct payload", () => {
            const generator = new TemplateGenerator();
            const payloadResult = generator.generateTemplatePayload(baseMetadataDoc, "1.0.0");
            expect(payloadResult.success).toBe(true);
            if (payloadResult.success) {
                const validation = generator.validatePayload(payloadResult.data);
                expect(validation.success).toBe(true);
            }
        });

        it("should reject payload missing template version", () => {
            const generator = new TemplateGenerator();
            const invalidPayload = {
                template: {
                    generatedAt: new Date().toISOString(),
                    sourceDigestSha256: "abc123",
                } as any,
                features: [],
            };
            const validation = generator.validatePayload(invalidPayload);
            expect(validation.success).toBe(false);
            if (!validation.success) {
                expect(validation.error.type).toBe("validation");
            }
        });

        it("should reject payload missing generatedAt", () => {
            const generator = new TemplateGenerator();
            const invalidPayload = {
                template: {
                    version: "1.0.0",
                    sourceDigestSha256: "abc123",
                } as any,
                features: [],
            };
            const validation = generator.validatePayload(invalidPayload);
            expect(validation.success).toBe(false);
        });

        it("should reject payload missing sourceDigestSha256", () => {
            const generator = new TemplateGenerator();
            const invalidPayload = {
                template: {
                    version: "1.0.0",
                    generatedAt: new Date().toISOString(),
                } as any,
                features: [],
            };
            const validation = generator.validatePayload(invalidPayload);
            expect(validation.success).toBe(false);
        });

        it("should reject null payload", () => {
            const generator = new TemplateGenerator();
            const validation = generator.validatePayload(null as any);
            expect(validation.success).toBe(false);
        });
    });
});

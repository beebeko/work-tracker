import { describe, it, expect, beforeEach } from "vitest";
import { RunRoutingPipeline } from "../../../src/features/feature-governance/application/RunRoutingPipeline";
import { InMemoryMetadataRepository } from "../../../src/features/feature-governance/data/adapters";
import type { FeatureMetadataDocument } from "../../../src/features/feature-governance/contracts/types";

describe("RunRoutingPipeline Integration", () => {
    let baseMetadata: FeatureMetadataDocument;

    beforeEach(() => {
        baseMetadata = {
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
    });

    describe("execute", () => {
        it("should successfully execute full pipeline with valid metadata", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.version).toBe("1.0.0");
                expect(result.data.templatePayload).toBeDefined();
                expect(result.data.parityReport).toBeDefined();
                expect(result.data.parityReport.status).toBe("pass");
            }
        });

        it("should generate template payload with correct version", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "2.1.3");
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.templatePayload.template.version).toBe("2.1.3");
            }
        });

        it("should generate template payload with source digest", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.templatePayload.template.sourceDigestSha256).toMatch(
                    /^[a-f0-9]{64}$/,
                );
            }
        });

        it("should pass parity check for generated payload", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.parityReport.status).toBe("pass");
                expect(result.data.parityReport.errors.length).toBe(0);
                expect(result.data.parityReport.details.every((d) => d.pass)).toBe(true);
            }
        });

        it("should include all features in template payload", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.templatePayload.features.length).toBe(2);
                expect(result.data.templatePayload.features[0].featureId).toBe("F-001");
                expect(result.data.templatePayload.features[1].featureId).toBe("F-004");
            }
        });

        it("should derive next version when oldMetadata is provided", async () => {
            const oldMetadata = {
                ...baseMetadata,
                features: [baseMetadata.features[0]], // Only one feature
            };
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(
                repository,
                "1.0.0",
                oldMetadata,
            );
            const result = await pipeline.execute();

            expect(result.success).toBe(true);
            if (result.success) {
                // Feature was added, so version should bump minor: 1.1.0
                expect(result.data.version).toBe("1.1.0");
            }
        });

        it("should handle empty feature list", async () => {
            const emptyMetadata: FeatureMetadataDocument = {
                ...baseMetadata,
                features: [],
            };
            const repository = new InMemoryMetadataRepository(emptyMetadata);
            // This should fail validation since features array must not be empty
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("validation");
            }
        });

        it("should fail on invalid metadata structure", async () => {
            const invalidMetadata = {
                features: null, // Invalid
            } as any;
            const repository = new InMemoryMetadataRepository(invalidMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.execute();

            expect(result.success).toBe(false);
            if (!result.success) {
                // Invalid structure will cause IO or validation error
                expect(["io", "validation"]).toContain(result.error.type);
            }
        });
    });

    describe("executeWithErrorOutput", () => {
        it("should return success object for valid pipeline", async () => {
            const repository = new InMemoryMetadataRepository(baseMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.executeWithErrorOutput();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it("should return error object on pipeline failure", async () => {
            const invalidMetadata = {
                features: null,
            } as any;
            const repository = new InMemoryMetadataRepository(invalidMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.executeWithErrorOutput();

            expect(result.success).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBeTruthy();
            expect(result.error?.message).toBeTruthy();
        });

        it("should include error code and message in output", async () => {
            const invalidMetadata = {
                features: [],
            } as any;
            const repository = new InMemoryMetadataRepository(invalidMetadata);
            const pipeline = new RunRoutingPipeline(repository, "1.0.0");
            const result = await pipeline.executeWithErrorOutput();

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error?.code).toBe("validation");
                expect(result.error?.message).toContain("Features array must not be empty");
            }
        });
    });

    describe("Determinism validation", () => {
        it("should produce same results for multiple executions", async () => {
            const repository1 = new InMemoryMetadataRepository(baseMetadata);
            const repository2 = new InMemoryMetadataRepository(baseMetadata);

            const pipeline1 = new RunRoutingPipeline(repository1, "1.0.0");
            const pipeline2 = new RunRoutingPipeline(repository2, "1.0.0");

            const result1 = await pipeline1.execute();
            const result2 = await pipeline2.execute();

            expect(result1.success && result2.success).toBe(true);
            if (result1.success && result2.success) {
                expect(result1.data.templatePayload.template.sourceDigestSha256).toBe(
                    result2.data.templatePayload.template.sourceDigestSha256,
                );
            }
        });

        it("should detect changes in metadata through version bumping", async () => {
            const oldMetadata = baseMetadata;
            const newMetadata = {
                ...baseMetadata,
                lastUpdated: "2026-04-20", // Patch-level change
            };

            const repository1 = new InMemoryMetadataRepository(oldMetadata);
            const repository2 = new InMemoryMetadataRepository(newMetadata);

            const pipeline1 = new RunRoutingPipeline(repository1, "1.0.0", oldMetadata);
            const pipeline2 = new RunRoutingPipeline(repository2, "1.0.0", oldMetadata);

            const result1 = await pipeline1.execute();
            const result2 = await pipeline2.execute();

            expect(result1.success && result2.success).toBe(true);
            if (result1.success && result2.success) {
                // Both should bump to 1.0.1 for patch-level change
                expect(result1.data.version).toBe("1.0.1");
                expect(result2.data.version).toBe("1.0.1");
            }
        });
    });
});

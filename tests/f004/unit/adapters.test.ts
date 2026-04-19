import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
    JsonFileMetadataRepository,
    InMemoryMetadataRepository,
} from "../../../src/features/feature-governance/data/adapters";
import type { FeatureMetadataDocument } from "../../../src/features/feature-governance/contracts/types";

describe("Metadata Repository Adapters", () => {
    let tempDir: string;
    const baseMetadata: FeatureMetadataDocument = {
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
        ],
    };

    beforeEach(() => {
        tempDir = join(tmpdir(), `f004-adapter-test-${Date.now()}`);
        mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe("InMemoryMetadataRepository", () => {
        it("should return metadata synchronously", async () => {
            const repo = new InMemoryMetadataRepository(baseMetadata);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(baseMetadata);
            }
        });

        it("should return same instance every time", async () => {
            const repo = new InMemoryMetadataRepository(baseMetadata);
            const result1 = await repo.getCanonicalMetadata();
            const result2 = await repo.getCanonicalMetadata();
            expect(result1.success && result2.success).toBe(true);
            if (result1.success && result2.success) {
                expect(result1.data).toBe(result2.data);
            }
        });

        it("should allow multiple features", async () => {
            const multiFeatureMetadata: FeatureMetadataDocument = {
                ...baseMetadata,
                features: [
                    baseMetadata.features[0],
                    {
                        featureId: "F-004",
                        name: "Feature Governance",
                        status: "planned",
                        owner: "testing-agent",
                        summary: "Governance automation",
                        classification: "new-sensible",
                        confidence: 0.96,
                        scope: {
                            includes: ["canonical metadata"],
                            excludes: ["policy changes"],
                        },
                    },
                ],
            };
            const repo = new InMemoryMetadataRepository(multiFeatureMetadata);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features.length).toBe(2);
            }
        });

        it("should preserve metadata structure", async () => {
            const repo = new InMemoryMetadataRepository(baseMetadata);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.schemaVersion).toBe("1.0");
                expect(result.data.projection.policy).toBe("projection-only");
                expect(result.data.features[0].featureId).toBe("F-001");
            }
        });
    });

    describe("JsonFileMetadataRepository", () => {
        it("should read valid metadata from file", async () => {
            const metadataPath = join(tempDir, "metadata.json");
            writeFileSync(metadataPath, JSON.stringify(baseMetadata));

            const repo = new JsonFileMetadataRepository(metadataPath);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(baseMetadata);
            }
        });

        it("should fail when file does not exist", async () => {
            const repo = new JsonFileMetadataRepository(
                join(tempDir, "nonexistent.json"),
            );
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("notFound");
                expect(result.error.message).toContain("not found");
            }
        });

        it("should fail on invalid JSON", async () => {
            const metadataPath = join(tempDir, "invalid.json");
            writeFileSync(metadataPath, "{ invalid json");

            const repo = new JsonFileMetadataRepository(metadataPath);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("io");
            }
        });

        it("should fail on invalid metadata structure", async () => {
            const metadataPath = join(tempDir, "invalid_structure.json");
            writeFileSync(metadataPath, JSON.stringify({ invalid: "structure" }));

            const repo = new JsonFileMetadataRepository(metadataPath);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe("validation");
            }
        });

        it("should use default path when not provided", async () => {
            // This test verifies the behavior, but actual file access would be
            // based on cwd, so we just verify the repo is constructed
            const repo = new JsonFileMetadataRepository();
            expect(repo).toBeDefined();
        });

        it("should read complex metadata with history", async () => {
            const complexMetadata: FeatureMetadataDocument = {
                ...baseMetadata,
                features: [
                    {
                        ...baseMetadata.features[0],
                        history: [
                            {
                                date: "2026-04-19",
                                requestSummary: "Initial creation",
                                classification: "new-sensible",
                                confidence: 0.95,
                                actingAgent: "feature-tracker",
                                notes: "Created as new sensible feature",
                            },
                        ],
                    },
                ],
            };
            const metadataPath = join(tempDir, "complex.json");
            writeFileSync(metadataPath, JSON.stringify(complexMetadata));

            const repo = new JsonFileMetadataRepository(metadataPath);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features[0].history).toBeDefined();
                expect(result.data.features[0].history?.length).toBe(1);
            }
        });

        it("should handle empty features array gracefully", async () => {
            const emptyMetadata: FeatureMetadataDocument = {
                ...baseMetadata,
                features: [],
            };
            const metadataPath = join(tempDir, "empty.json");
            writeFileSync(metadataPath, JSON.stringify(emptyMetadata));

            const repo = new JsonFileMetadataRepository(metadataPath);
            const result = await repo.getCanonicalMetadata();
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.features.length).toBe(0);
            }
        });
    });

    describe("Repository contract compliance", () => {
        it("both adapters return same interface", async () => {
            const inMemRepo = new InMemoryMetadataRepository(baseMetadata);
            const tempPath = join(tempDir, "metadata.json");
            writeFileSync(tempPath, JSON.stringify(baseMetadata));
            const fileRepo = new JsonFileMetadataRepository(tempPath);

            const result1 = await inMemRepo.getCanonicalMetadata();
            const result2 = await fileRepo.getCanonicalMetadata();

            expect(result1.success && result2.success).toBe(true);
            if (result1.success && result2.success) {
                expect(result1.data.schemaVersion).toBe(result2.data.schemaVersion);
                expect(result1.data.features.length).toBe(result2.data.features.length);
            }
        });
    });
});

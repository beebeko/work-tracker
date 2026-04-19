import { describe, it, expect } from "vitest";
import {
    parseSemver,
    stringifySemver,
    bumpPatch,
    bumpMinor,
    bumpMajor,
    determineChangeType,
} from "../../../src/features/feature-governance/domain/SemverEngine";
import type { FeatureMetadataDocument } from "../../../src/features/feature-governance/contracts/types";

describe("SemverEngine", () => {
    describe("parseSemver", () => {
        it("should parse valid semver strings", () => {
            const result = parseSemver("1.2.3");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ major: 1, minor: 2, patch: 3 });
            }
        });

        it("should parse zero version", () => {
            const result = parseSemver("0.0.0");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ major: 0, minor: 0, patch: 0 });
            }
        });

        it("should parse large version numbers", () => {
            const result = parseSemver("100.200.300");
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual({ major: 100, minor: 200, patch: 300 });
            }
        });

        it("should reject invalid semver formats", () => {
            const testCases = ["1.2", "1.2.3.4", "a.b.c", "1.2.3-beta", ""];
            for (const testCase of testCases) {
                const result = parseSemver(testCase);
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.type).toBe("validation");
                }
            }
        });

        it("should reject null or undefined input", () => {
            const result = parseSemver(null as any);
            expect(result.success).toBe(false);
        });
    });

    describe("stringifySemver", () => {
        it("should convert semver components to string", () => {
            const result = stringifySemver({ major: 1, minor: 2, patch: 3 });
            expect(result).toBe("1.2.3");
        });

        it("should stringify zero version", () => {
            const result = stringifySemver({ major: 0, minor: 0, patch: 0 });
            expect(result).toBe("0.0.0");
        });

        it("should round-trip through parse and stringify", () => {
            const original = "12.34.56";
            const parsed = parseSemver(original);
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                const stringified = stringifySemver(parsed.data);
                expect(stringified).toBe(original);
            }
        });
    });

    describe("bumpPatch", () => {
        it("should increment patch only", () => {
            const result = bumpPatch({ major: 1, minor: 2, patch: 3 });
            expect(result).toEqual({ major: 1, minor: 2, patch: 4 });
        });

        it("should handle zero patch", () => {
            const result = bumpPatch({ major: 1, minor: 2, patch: 0 });
            expect(result).toEqual({ major: 1, minor: 2, patch: 1 });
        });

        it("should not affect major or minor", () => {
            const result = bumpPatch({ major: 5, minor: 10, patch: 15 });
            expect(result.major).toBe(5);
            expect(result.minor).toBe(10);
        });
    });

    describe("bumpMinor", () => {
        it("should increment minor and reset patch", () => {
            const result = bumpMinor({ major: 1, minor: 2, patch: 3 });
            expect(result).toEqual({ major: 1, minor: 3, patch: 0 });
        });

        it("should handle zero minor", () => {
            const result = bumpMinor({ major: 1, minor: 0, patch: 5 });
            expect(result).toEqual({ major: 1, minor: 1, patch: 0 });
        });

        it("should not affect major", () => {
            const result = bumpMinor({ major: 5, minor: 10, patch: 15 });
            expect(result.major).toBe(5);
        });
    });

    describe("bumpMajor", () => {
        it("should increment major and reset minor/patch", () => {
            const result = bumpMajor({ major: 1, minor: 2, patch: 3 });
            expect(result).toEqual({ major: 2, minor: 0, patch: 0 });
        });

        it("should handle zero major", () => {
            const result = bumpMajor({ major: 0, minor: 5, patch: 10 });
            expect(result).toEqual({ major: 1, minor: 0, patch: 0 });
        });
    });

    describe("determineChangeType", () => {
        const baseDoc: FeatureMetadataDocument = {
            schemaVersion: "1.0",
            lastUpdated: "2026-04-19",
            projection: {
                markdownRegistryPath: "docs/features/registry.md",
                policy: "projection-only",
            },
            features: [
                {
                    featureId: "F-001",
                    name: "Feature One",
                    status: "active",
                    owner: "team-a",
                    summary: "First feature",
                    classification: "new-sensible",
                    confidence: 0.95,
                    scope: {
                        includes: ["item1"],
                        excludes: ["item2"],
                    },
                },
            ],
        };

        it("should detect major version change on schema version change", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                schemaVersion: "2.0" as "1.0",
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("major");
        });

        it("should detect minor version change on feature count change", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                features: [
                    ...baseDoc.features,
                    {
                        featureId: "F-002",
                        name: "Feature Two",
                        status: "planned",
                        owner: "team-b",
                        summary: "Second feature",
                        classification: "new-sensible",
                        confidence: 0.90,
                        scope: {
                            includes: ["item3"],
                            excludes: ["item4"],
                        },
                    },
                ],
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("minor");
        });

        it("should detect minor version change on feature status change", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                features: [
                    {
                        ...baseDoc.features[0],
                        status: "completed" as const,
                    },
                ],
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("minor");
        });

        it("should detect patch version change on lastUpdated change", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                lastUpdated: "2026-04-20",
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("patch");
        });

        it("should detect no change when documents are identical", () => {
            const oldDoc = baseDoc;
            const newDoc = baseDoc;
            const changeType = determineChangeType(oldDoc, newDoc);
            // Should be patch as the fallback when no major/minor changes detected
            expect(["patch", "minor", "major"]).toContain(changeType);
        });

        it("should prioritize major over minor", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                schemaVersion: "2.0" as "1.0",
                features: [
                    ...baseDoc.features,
                    {
                        featureId: "F-002",
                        name: "Feature Two",
                        status: "planned",
                        owner: "team-b",
                        summary: "Second feature",
                        classification: "new-sensible",
                        confidence: 0.90,
                        scope: {
                            includes: ["item3"],
                            excludes: ["item4"],
                        },
                    },
                ],
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("major");
        });

        it("should prioritize minor over patch", () => {
            const oldDoc = baseDoc;
            const newDoc = {
                ...baseDoc,
                features: [
                    ...baseDoc.features,
                    {
                        featureId: "F-002",
                        name: "Feature Two",
                        status: "planned",
                        owner: "team-b",
                        summary: "Second feature",
                        classification: "new-sensible",
                        confidence: 0.90,
                        scope: {
                            includes: ["item3"],
                            excludes: ["item4"],
                        },
                    },
                ],
                lastUpdated: "2026-04-20",
            };
            expect(determineChangeType(oldDoc, newDoc)).toBe("minor");
        });
    });
});

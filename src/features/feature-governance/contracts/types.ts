/**
 * Canonical feature-governance contracts.
 * The markdown registry is projection-only and must not be treated as the source of truth.
 */

export type GovernanceClassification = "existing" | "new-sensible" | "neither";

export type GovernanceFeatureStatus =
    | "planned"
    | "active"
    | "paused"
    | "completed";

export type FeatureScope = {
    includes: string[];
    excludes: string[];
};

export type FeatureHistoryEntry = {
    date: string; // YYYY-MM-DD
    requestSummary: string;
    classification: GovernanceClassification;
    confidence: number;
    actingAgent: string;
    notes?: string;
};

export type FeatureMetadataRecord = {
    featureId: string;
    name: string;
    status: GovernanceFeatureStatus;
    owner: string;
    summary: string;
    classification: GovernanceClassification;
    confidence: number;
    scope: FeatureScope;
    history?: FeatureHistoryEntry[];
};

export type FeatureMetadataProjection = {
    markdownRegistryPath: string;
    policy: "projection-only";
};

export type FeatureMetadataMigration = {
    sourcePath: string;
    sourceFormat: "registry-markdown-yaml-fence";
    sourceDigestSha256: string;
    lastReportPath: string;
    capturedAt: string; // ISO 8601
};

export type FeatureMetadataDocument = {
    schemaVersion: "1.0";
    lastUpdated: string; // YYYY-MM-DD
    projection: FeatureMetadataProjection;
    features: FeatureMetadataRecord[];
    migration?: FeatureMetadataMigration;
};

export type FeatureGovernanceError =
    | {
          type: "validation";
          message: string;
          field?: string;
      }
    | {
          type: "notFound";
          message: string;
      }
    | {
          type: "io";
          message: string;
          cause?: Error;
      };

export type FeatureGovernanceResult<T> =
    | { success: true; data: T }
    | { success: false; error: FeatureGovernanceError };

export const governanceOk = <T>(data: T): FeatureGovernanceResult<T> => ({
    success: true,
    data,
});

export const governanceErr = (
    error: FeatureGovernanceError,
): FeatureGovernanceResult<never> => ({
    success: false,
    error,
});

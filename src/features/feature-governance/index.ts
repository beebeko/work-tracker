export type {
    FeatureGovernanceError,
    FeatureGovernanceResult,
    FeatureMetadataDocument,
    FeatureMetadataMigration,
    FeatureMetadataProjection,
    FeatureMetadataRecord,
    FeatureHistoryEntry,
    FeatureScope,
    GovernanceClassification,
    GovernanceFeatureStatus,
} from "./contracts/types";

export {
    governanceErr,
    governanceOk,
} from "./contracts/types";

export type { IFeatureMetadataRepository } from "./data/dal";

export {
    JsonFileMetadataRepository,
    InMemoryMetadataRepository,
} from "./data/adapters";

export {
    RunRoutingPipeline,
} from "./application/RunRoutingPipeline";

export {
    SemverEngine,
    parseSemver,
    stringifySemver,
    bumpPatch,
    bumpMinor,
    bumpMajor,
    determineChangeType,
} from "./domain/SemverEngine";

export {
    TemplateGenerator,
    computeSourceDigest,
} from "./domain/TemplateGenerator";

export {
    ParityChecker,
} from "./domain/ParityChecker";

export type {
    SemverVersion,
} from "./domain/SemverEngine";

export type {
    CommitTemplatePayload,
} from "./domain/TemplateGenerator";

export type {
    ParityCheckReport,
} from "./domain/ParityChecker";

export type {
    PipelineResult,
} from "./application/RunRoutingPipeline";

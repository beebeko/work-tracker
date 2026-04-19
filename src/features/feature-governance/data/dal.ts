import type {
    FeatureGovernanceResult,
    FeatureMetadataDocument,
} from "../contracts/types";

/**
 * Datastore-agnostic DAL contract for canonical feature governance metadata.
 * Consumers must read metadata through this interface, not from markdown.
 */
export interface IFeatureMetadataRepository {
    getCanonicalMetadata(): Promise<FeatureGovernanceResult<FeatureMetadataDocument>>;
}

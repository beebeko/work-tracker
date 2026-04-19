import type { FeatureMetadataDocument } from "../contracts/types";
import { governanceErr, governanceOk } from "../contracts/types";
import type { FeatureGovernanceResult } from "../contracts/types";

/**
 * Semver version structure.
 * Format: MAJOR.MINOR.PATCH
 */
export type SemverVersion = {
    major: number;
    minor: number;
    patch: number;
};

/**
 * Parse a semver string into components.
 * Returns error if format is invalid.
 */
export function parseSemver(version: string): FeatureGovernanceResult<SemverVersion> {
    if (!version || typeof version !== "string") {
        return governanceErr({
            type: "validation",
            message: `Invalid semver format: ${version}. Expected MAJOR.MINOR.PATCH`,
            field: "version",
        });
    }
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        return governanceErr({
            type: "validation",
            message: `Invalid semver format: ${version}. Expected MAJOR.MINOR.PATCH`,
            field: "version",
        });
    }

    return governanceOk({
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    });
}

/**
 * Convert semver components back to string.
 */
export function stringifySemver(version: SemverVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Increment patch version deterministically.
 * Bumps patch and resets nothing (patch-only increment).
 */
export function bumpPatch(version: SemverVersion): SemverVersion {
    return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
    };
}

/**
 * Increment minor version and reset patch.
 * Used for feature additions or changes to metadata classification/confidence.
 */
export function bumpMinor(version: SemverVersion): SemverVersion {
    return {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
    };
}

/**
 * Increment major version and reset minor/patch.
 * Used for breaking changes (e.g., schema incompatibility, ownership changes).
 */
export function bumpMajor(version: SemverVersion): SemverVersion {
    return {
        major: version.major + 1,
        minor: 0,
        patch: 0,
    };
}

/**
 * Determine change type by comparing old and new metadata documents.
 * Returns the appropriate semver bump strategy.
 *
 * Bump rules:
 * - Major: schemaVersion changes, breaking structural changes
 * - Minor: feature count changes, ownership/status/classification changes, scope changes
 * - Patch: history entries added, lastUpdated changed, metadata refined
 */
export function determineChangeType(
    oldDoc: FeatureMetadataDocument,
    newDoc: FeatureMetadataDocument,
): "major" | "minor" | "patch" {
    // Breaking: schema version changed
    if (oldDoc.schemaVersion !== newDoc.schemaVersion) {
        return "major";
    }

    // Feature count changed (added/removed features)
    if (oldDoc.features.length !== newDoc.features.length) {
        return "minor";
    }

    // Compare each feature
    for (let i = 0; i < oldDoc.features.length; i++) {
        const oldFeature = oldDoc.features[i];
        const newFeature = newDoc.features[i];

        // Feature ID or position changed
        if (oldFeature.featureId !== newFeature.featureId) {
            return "minor";
        }

        // Owner/status/classification/confidence changed
        if (
            oldFeature.owner !== newFeature.owner ||
            oldFeature.status !== newFeature.status ||
            oldFeature.classification !== newFeature.classification ||
            oldFeature.confidence !== newFeature.confidence ||
            oldFeature.name !== newFeature.name
        ) {
            return "minor";
        }

        // Scope changed
        if (
            JSON.stringify(oldFeature.scope) !== JSON.stringify(newFeature.scope)
        ) {
            return "minor";
        }

        // History length changed (new entries added)
        const oldHistLen = oldFeature.history?.length ?? 0;
        const newHistLen = newFeature.history?.length ?? 0;
        if (oldHistLen !== newHistLen) {
            return "patch";
        }
    }

    // lastUpdated or projection changes (minor metadata refinements)
    if (oldDoc.lastUpdated !== newDoc.lastUpdated) {
        return "patch";
    }

    if (JSON.stringify(oldDoc.projection) !== JSON.stringify(newDoc.projection)) {
        return "patch";
    }

    // No changes detected
    return "patch";
}

/**
 * Semver engine: deterministically derives the next version from canonical metadata.
 * Compares old and new metadata to determine change type, then applies bump rule.
 */
export class SemverEngine {
    private currentVersion: SemverVersion;

    constructor(versionString: string) {
        const result = parseSemver(versionString);
        if (!result.success) {
            throw new Error(result.error.message);
        }
        this.currentVersion = result.data;
    }

    /**
     * Derive next version by comparing old and new metadata documents.
     */
    deriveNextVersion(
        oldDoc: FeatureMetadataDocument,
        newDoc: FeatureMetadataDocument,
    ): SemverVersion {
        const changeType = determineChangeType(oldDoc, newDoc);

        switch (changeType) {
            case "major":
                return bumpMajor(this.currentVersion);
            case "minor":
                return bumpMinor(this.currentVersion);
            case "patch":
            default:
                return bumpPatch(this.currentVersion);
        }
    }

    /**
     * Get current version as string.
     */
    getCurrentVersionString(): string {
        return stringifySemver(this.currentVersion);
    }

    /**
     * Get current version components.
     */
    getCurrentVersion(): SemverVersion {
        return { ...this.currentVersion };
    }
}

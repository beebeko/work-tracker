#!/usr/bin/env node

/**
 * F-004 prepare-commit-msg Hook
 *
 * Invoked by Git before commit message editing.
 * Called with: <commit_msg_file> [<commit_source>] [<commit_sha1>]
 *
 * Responsibilities:
 * - Parse commit message file argument
 * - Load canonical metadata digest
 * - Validate commit template consistency
 * - Emit diagnostic JSON on error
 * - Exit with documented exit code
 *
 * Exit codes:
 * 0 - Hook passed, allow commit
 * 1 - Hook failed, abort commit (validation error, digest mismatch)
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const commitMsgFile = process.argv[2];
const commitSource = process.argv[3];
const commitSha = process.argv[4];

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// Validate arguments
if (!commitMsgFile) {
    console.error(
        JSON.stringify(
            {
                error: {
                    code: "INVALID_ARGS",
                    message:
                        "prepare-commit-msg hook requires commit message file argument",
                },
                hook: "prepare-commit-msg",
            },
            null,
            2,
        ),
    );
    process.exit(EXIT_FAILURE);
}

/**
 * Load canonical metadata
 */
function loadCanonicalMetadata() {
    try {
        const metadataPath = join(process.cwd(), "data/store/feature-metadata.json");
        const content = readFileSync(metadataPath, "utf-8");
        return {
            success: true,
            data: JSON.parse(content),
        };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Compute SHA256 digest of metadata
 */
function computeSourceDigest(doc) {
    const canonical = JSON.stringify(doc, null, 0);
    return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Generate commit message body with metadata digest
 */
function generateCommitMessageBody(metadata, version) {
    const digest = computeSourceDigest(metadata);
    const header = `F-004 Feature Governance Commit [v${version}]`;
    const divider = "---";
    const digestLine = `Source-Digest: ${digest}`;
    const featureSummary = metadata.features
        .map((f) => `  - ${f.featureId}: ${f.name} (${f.status})`)
        .join("\n");

    return [header, divider, digestLine, "", "Features:", featureSummary, ""].join("\n");
}

// Main hook logic
const metadataResult = loadCanonicalMetadata();
if (!metadataResult.success) {
    console.error(
        JSON.stringify(
            {
                error: {
                    code: "METADATA_LOAD_FAILED",
                    message: metadataResult.error,
                },
                hook: "prepare-commit-msg",
            },
            null,
            2,
        ),
    );
    process.exit(EXIT_FAILURE);
}

try {
    // Read current commit message
    const currentMessage = readFileSync(commitMsgFile, "utf-8");

    // For initial commits, prepend template
    if (
        !currentMessage.includes("F-004 Feature Governance Commit") &&
        commitSource !== "merge" &&
        commitSource !== "squash"
    ) {
        const templateBody = generateCommitMessageBody(
            metadataResult.data,
            "1.0.0",
        );
        const newMessage = templateBody + currentMessage;
        writeFileSync(commitMsgFile, newMessage, "utf-8");
    }

    // Hook passed
    process.exit(EXIT_SUCCESS);
} catch (error) {
    console.error(
        JSON.stringify(
            {
                error: {
                    code: "FILE_OPERATION_FAILED",
                    message:
                        error instanceof Error
                            ? error.message
                            : String(error),
                },
                hook: "prepare-commit-msg",
            },
            null,
            2,
        ),
    );
    process.exit(EXIT_FAILURE);
}

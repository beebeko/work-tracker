#!/usr/bin/env node

/**
 * F-004 commit-msg Hook
 *
 * Invoked by Git after commit message is edited.
 * Called with: <commit_msg_file>
 *
 * Responsibilities:
 * - Parse commit message file argument
 * - Verify template payload digest
 * - Check parity between metadata and commit message
 * - Validate required trailers (Source-Digest)
 * - Emit diagnostic JSON on error
 * - Exit with documented exit code
 *
 * Exit codes:
 * 0 - Hook passed, allow commit
 * 1 - Hook failed, abort commit
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const commitMsgFile = process.argv[2];

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

// Validate arguments
if (!commitMsgFile) {
    console.error(
        JSON.stringify(
            {
                error: {
                    code: "INVALID_ARGS",
                    message: "commit-msg hook requires commit message file argument",
                },
                hook: "commit-msg",
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
 * Extract Source-Digest trailer from commit message
 */
function extractSourceDigest(message) {
    // Look for "Source-Digest: <64-char hex string>"
    const match = message.match(/Source-Digest:\s*([a-f0-9]{64})/i);
    return match ? match[1] : null;
}

/**
 * Validate commit message trailers
 */
function validateCommitMessageTrailers(message, expectedDigest) {
    const errors = [];

    // Check for required Source-Digest trailer
    if (!message.includes("F-004 Feature Governance Commit")) {
        // Skip validation for non-governance commits
        return { valid: true, errors: [] };
    }

    const extractedDigest = extractSourceDigest(message);
    if (!extractedDigest) {
        errors.push(
            "Missing required Source-Digest trailer in commit message",
        );
        return { valid: false, errors };
    }

    if (extractedDigest !== expectedDigest) {
        errors.push(
            `Source-Digest mismatch: expected ${expectedDigest}, got ${extractedDigest}`,
        );
        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}

// Main hook logic
try {
    const commitMessage = readFileSync(commitMsgFile, "utf-8");

    // Check if this is a governance commit
    if (!commitMessage.includes("F-004 Feature Governance Commit")) {
        // Non-governance commits are allowed
        process.exit(EXIT_SUCCESS);
    }

    // Load metadata
    const metadataResult = loadCanonicalMetadata();
    if (!metadataResult.success) {
        console.error(
            JSON.stringify(
                {
                    error: {
                        code: "METADATA_LOAD_FAILED",
                        message: metadataResult.error,
                    },
                    hook: "commit-msg",
                },
                null,
                2,
            ),
        );
        process.exit(EXIT_FAILURE);
    }

    // Compute expected digest
    const expectedDigest = computeSourceDigest(metadataResult.data);

    // Validate trailers
    const validation = validateCommitMessageTrailers(
        commitMessage,
        expectedDigest,
    );
    if (!validation.valid) {
        console.error(
            JSON.stringify(
                {
                    error: {
                        code: "INVALID_COMMIT_MESSAGE",
                        message: validation.errors.join("; "),
                    },
                    hook: "commit-msg",
                    details: validation.errors,
                },
                null,
                2,
            ),
        );
        process.exit(EXIT_FAILURE);
    }

    // Commit passed validation
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
                hook: "commit-msg",
            },
            null,
            2,
        ),
    );
    process.exit(EXIT_FAILURE);
}

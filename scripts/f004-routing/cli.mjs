#!/usr/bin/env node

/**
 * F-004 Feature Governance CLI Entrypoint
 *
 * Commands:
 *   generate   - Generate commit template payload from canonical metadata
 *   parity     - Run parity check on current metadata vs template
 *   verify     - Full pipeline: generate -> validate -> parity check
 *
 * Exit codes:
 *   0  - Success
 *   1  - General error (metadata load, I/O, etc.)
 *   2  - Validation error (template invalid, parity mismatch)
 *   3  - Configuration error (missing args, invalid command)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

// Exit code constants
const EXIT_SUCCESS = 0;
const EXIT_IO_ERROR = 1;
const EXIT_VALIDATION_ERROR = 2;
const EXIT_CONFIG_ERROR = 3;

/**
 * Load metadata from canonical source
 */
function loadCanonicalMetadata() {
    try {
        const metadataPath = join(process.cwd(), "data/store/feature-metadata.json");
        const content = readFileSync(metadataPath, "utf-8");
        return {
            success: true,
            data: JSON.parse(content),
            error: null,
        };
    } catch (error) {
        return {
            success: false,
            data: null,
            error: {
                type: "io",
                message:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
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
 * Validate template payload
 */
function validateTemplatePayload(payload) {
    if (!payload?.template?.version) {
        return { success: false, error: "Missing template.version" };
    }
    if (!payload?.template?.generatedAt) {
        return { success: false, error: "Missing template.generatedAt" };
    }
    if (!payload?.template?.sourceDigestSha256) {
        return { success: false, error: "Missing template.sourceDigestSha256" };
    }
    if (!/^[a-f0-9]{64}$/.test(payload.template.sourceDigestSha256)) {
        return { success: false, error: "Invalid sourceDigestSha256 format" };
    }
    if (!Array.isArray(payload.features) || payload.features.length === 0) {
        return { success: false, error: "Features array must not be empty" };
    }
    return { success: true, error: null };
}

/**
 * Generate template payload
 */
function generateTemplatePayload(metadata, version) {
    try {
        const digest = computeSourceDigest(metadata);
        const payload = {
            template: {
                version,
                generatedAt: new Date().toISOString(),
                sourceDigestSha256: digest,
            },
            features: metadata.features.map((f) => ({
                featureId: f.featureId,
                name: f.name,
                status: f.status,
            })),
        };

        const validation = validateTemplatePayload(payload);
        if (!validation.success) {
            return { success: false, error: validation.error };
        }

        return { success: true, data: payload, error: null };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        };
    }
}

/**
 * Check parity between metadata and payload
 */
function checkParity(metadata, payload) {
    const checks = [];
    const errors = [];

    // Digest parity
    const sourceDigest = computeSourceDigest(metadata);
    const payloadDigest = payload.template.sourceDigestSha256;
    const digestMatch = sourceDigest === payloadDigest;
    checks.push({
        check: "sourceDigestSha256 parity",
        pass: digestMatch,
        details: digestMatch
            ? "Digests match"
            : "Digest mismatch: source and payload out of sync",
    });
    if (!digestMatch) {
        errors.push({
            code: "DIGEST_MISMATCH",
            message:
                "Source metadata digest does not match payload digest. Regenerate template.",
        });
    }

    // Feature count parity
    const countMatch =
        metadata.features.length === payload.features.length;
    checks.push({
        check: "feature count parity",
        pass: countMatch,
        details: countMatch
            ? `Both have ${metadata.features.length} features`
            : `Count mismatch: source=${metadata.features.length}, payload=${payload.features.length}`,
    });
    if (!countMatch) {
        errors.push({
            code: "FEATURE_COUNT_MISMATCH",
            message:
                "Feature count in payload does not match source. Regenerate template.",
        });
    }

    // Feature ID parity
    let idMatch = true;
    if (metadata.features.length === payload.features.length) {
        for (let i = 0; i < metadata.features.length; i++) {
            if (
                metadata.features[i].featureId !==
                payload.features[i].featureId
            ) {
                idMatch = false;
                break;
            }
        }
    } else {
        idMatch = false;
    }
    checks.push({
        check: "feature ID order parity",
        pass: idMatch,
        details: idMatch
            ? "All feature IDs match in order"
            : "Feature ID mismatch or reordering detected",
    });
    if (!idMatch) {
        errors.push({
            code: "FEATURE_ID_MISMATCH",
            message:
                "Feature IDs in payload do not match source order. Regenerate template.",
        });
    }

    const allPass = checks.every((c) => c.pass);
    return {
        status: allPass ? "pass" : "fail",
        timestamp: new Date().toISOString(),
        sourceDigest,
        payloadDigest,
        featureCount: {
            source: metadata.features.length,
            payload: payload.features.length,
            match: countMatch,
        },
        details: checks,
        errors,
    };
}

/**
 * Handle generate command
 */
function handleGenerate() {
    const metadataResult = loadCanonicalMetadata();
    if (!metadataResult.success) {
        console.log(
            JSON.stringify(
                {
                    error: {
                        code: metadataResult.error.type,
                        message: metadataResult.error.message,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_IO_ERROR;
    }

    const templateResult = generateTemplatePayload(
        metadataResult.data,
        "1.0.0",
    );
    if (!templateResult.success) {
        console.log(
            JSON.stringify(
                {
                    error: {
                        code: "VALIDATION",
                        message: templateResult.error,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_VALIDATION_ERROR;
    }

    console.log(
        JSON.stringify(
            {
                status: "success",
                data: templateResult.data,
            },
            null,
            2,
        ),
    );
    return EXIT_SUCCESS;
}

/**
 * Handle parity command
 */
function handleParity() {
    const metadataResult = loadCanonicalMetadata();
    if (!metadataResult.success) {
        console.log(
            JSON.stringify(
                {
                    error: {
                        code: metadataResult.error.type,
                        message: metadataResult.error.message,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_IO_ERROR;
    }

    const templateResult = generateTemplatePayload(
        metadataResult.data,
        "1.0.0",
    );
    if (!templateResult.success) {
        console.log(
            JSON.stringify(
                {
                    error: {
                        code: "VALIDATION",
                        message: templateResult.error,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_VALIDATION_ERROR;
    }

    const report = checkParity(
        metadataResult.data,
        templateResult.data,
    );
    const exitCode = report.status === "pass" ? EXIT_SUCCESS : EXIT_VALIDATION_ERROR;

    console.log(
        JSON.stringify(
            {
                status: report.status,
                data: report,
            },
            null,
            2,
        ),
    );
    return exitCode;
}

/**
 * Handle verify command
 */
function handleVerify() {
    const metadataResult = loadCanonicalMetadata();
    if (!metadataResult.success) {
        console.log(
            JSON.stringify(
                {
                    success: false,
                    error: {
                        code: metadataResult.error.type,
                        message: metadataResult.error.message,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_IO_ERROR;
    }

    const templateResult = generateTemplatePayload(
        metadataResult.data,
        "1.0.0",
    );
    if (!templateResult.success) {
        console.log(
            JSON.stringify(
                {
                    success: false,
                    error: {
                        code: "validation",
                        message: templateResult.error,
                    },
                },
                null,
                2,
            ),
        );
        return EXIT_VALIDATION_ERROR;
    }

    const parityReport = checkParity(
        metadataResult.data,
        templateResult.data,
    );

    console.log(
        JSON.stringify(
            {
                success: parityReport.status === "pass",
                data: {
                    version: "1.0.0",
                    templatePayload: templateResult.data,
                    parityReport,
                },
            },
            null,
            2,
        ),
    );

    return parityReport.status === "pass" ? EXIT_SUCCESS : EXIT_VALIDATION_ERROR;
}

// Main CLI routing
const cmd = process.argv[2];

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(`
F-004 Feature Governance CLI

Usage:
  npx f004 generate        Generate commit template from metadata
  npx f004 parity          Check parity between metadata and template
  npx f004 verify          Full verification pipeline
  npx f004 help            Show this help

Exit codes:
  0 - Success
  1 - General/I/O error
  2 - Validation/parity error
  3 - Configuration error
    `);
    process.exit(EXIT_SUCCESS);
}

let exitCode = EXIT_CONFIG_ERROR;

switch (cmd) {
    case "generate":
        exitCode = handleGenerate();
        break;
    case "parity":
        exitCode = handleParity();
        break;
    case "verify":
        exitCode = handleVerify();
        break;
    default:
        console.error(
            JSON.stringify(
                {
                    error: {
                        code: "UNKNOWN_COMMAND",
                        message: `Unknown command: ${cmd}`,
                    },
                },
                null,
                2,
            ),
        );
        exitCode = EXIT_CONFIG_ERROR;
}

process.exit(exitCode);

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv from "ajv";
import addFormats from "ajv-formats";

import type { FeatureMetadataDocument } from "../../src/features/feature-governance/contracts/types";

type MigrationArgs = {
    dryRun: boolean;
    registryPath: string;
    outputPath: string;
    reportPath: string;
};

type ValidationIssue = {
    instancePath: string;
    schemaPath: string;
    message: string;
};

type MigrationReport = {
    ok: boolean;
    dryRun: boolean;
    registryPath: string;
    outputPath: string;
    reportPath: string;
    sourceDigestSha256: string;
    extractedFeatureId: string;
    migratedFeatureCount: number;
    issues: ValidationIssue[];
    generatedAt: string;
};

function parseArgs(argv: string[]): MigrationArgs {
    const hasArg = (name: string) => argv.includes(name);
    const getArg = (name: string) => {
        const index = argv.indexOf(name);
        if (index === -1 || index + 1 >= argv.length) {
            return null;
        }

        return argv[index + 1];
    };

    return {
        dryRun: hasArg("--dry-run") || !hasArg("--write"),
        registryPath: getArg("--registry") ?? "docs/features/registry.md",
        outputPath:
            getArg("--output") ?? "data/store/feature-metadata.json",
        reportPath:
            getArg("--report") ??
            "data/migrations/reports/f004-data-management-validation-report.json",
    };
}

function digestSha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

function readQuotedValue(block: string, key: string): string {
    const match = block.match(new RegExp(`${key}:\\s+"([^"]+)"`));
    return match?.[1] ?? "";
}

function readConfidence(block: string): number {
    const match = block.match(/confidence:\s+([0-9]+(?:\.[0-9]+)?)/);
    const parsed = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
}

function readScopeLines(block: string, section: "includes" | "excludes"): string[] {
    const marker = `${section}:`;
    const start = block.indexOf(marker);
    if (start === -1) {
        return [];
    }

    const lines = block.slice(start + marker.length).split("\n");
    const values: string[] = [];

    for (const line of lines) {
        if (/^\s{6}\w/.test(line)) {
            break;
        }

        const match = line.match(/-\s+"([^"]+)"/);
        if (match) {
            values.push(match[1]);
        }
    }

    return values;
}

function extractFeatureBlockFromRegistry(markdown: string, featureId: string): string {
    const fencedYaml = markdown.match(/```yaml([\s\S]*?)```/);
    if (!fencedYaml) {
        throw new Error("Could not find a YAML fenced block in docs/features/registry.md");
    }

    const yamlBody = fencedYaml[1];
    const featureAnchor = `- feature_id: \"${featureId}\"`;
    const start = yamlBody.indexOf(featureAnchor);

    if (start === -1) {
        throw new Error(`Could not locate ${featureId} in registry YAML`);
    }

    const remaining = yamlBody.slice(start);
    const nextFeatureIndex = remaining.slice(1).indexOf("\n    - feature_id: \"");

    if (nextFeatureIndex === -1) {
        return remaining;
    }

    return remaining.slice(0, nextFeatureIndex + 1);
}

function buildCandidateDocument(
    block: string,
    args: MigrationArgs,
    sourceDigestSha256: string,
): FeatureMetadataDocument {
    const now = new Date();
    const dateOnly = now.toISOString().slice(0, 10);

    return {
        schemaVersion: "1.0",
        lastUpdated: dateOnly,
        projection: {
            markdownRegistryPath: "docs/features/registry.md",
            policy: "projection-only",
        },
        features: [
            {
                featureId: "F-004",
                name: readQuotedValue(block, "name") || "Feature Governance Automation",
                status: (readQuotedValue(block, "status") || "planned") as
                    | "planned"
                    | "active"
                    | "paused"
                    | "completed",
                owner: readQuotedValue(block, "owner") || "data-management",
                summary: readQuotedValue(block, "summary"),
                classification: (readQuotedValue(block, "classification") ||
                    "new-sensible") as "existing" | "new-sensible" | "neither",
                confidence: readConfidence(block),
                scope: {
                    includes: readScopeLines(block, "includes"),
                    excludes: readScopeLines(block, "excludes"),
                },
            },
        ],
        migration: {
            sourcePath: args.registryPath,
            sourceFormat: "registry-markdown-yaml-fence",
            sourceDigestSha256,
            lastReportPath: args.reportPath,
            capturedAt: now.toISOString(),
        },
    };
}

function toValidationIssues(errors: unknown): ValidationIssue[] {
    if (!Array.isArray(errors)) {
        return [];
    }

    return errors.map((error) => {
        const errorRecord = error as {
            instancePath?: string;
            schemaPath?: string;
            message?: string;
        };

        return {
            instancePath: errorRecord.instancePath ?? "",
            schemaPath: errorRecord.schemaPath ?? "",
            message: errorRecord.message ?? "validation error",
        };
    });
}

async function ensureParentDir(filePath: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
    await ensureParentDir(filePath);
    await writeFile(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf-8");
}

async function run(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const cwd = process.cwd();

    const resolvedRegistryPath = path.resolve(cwd, args.registryPath);
    const resolvedOutputPath = path.resolve(cwd, args.outputPath);
    const resolvedReportPath = path.resolve(cwd, args.reportPath);
    const resolvedSchemaPath = path.resolve(
        cwd,
        "data/schema/feature-metadata.schema.json",
    );

    const markdown = await readFile(resolvedRegistryPath, "utf-8");
    const schema = JSON.parse(await readFile(resolvedSchemaPath, "utf-8"));
    const featureBlock = extractFeatureBlockFromRegistry(markdown, "F-004");
    const sourceDigestSha256 = digestSha256(featureBlock);
    const candidate = buildCandidateDocument(
        featureBlock,
        args,
        sourceDigestSha256,
    );

    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const valid = validate(candidate);

    const issues = valid ? [] : toValidationIssues(validate.errors);
    const report: MigrationReport = {
        ok: Boolean(valid),
        dryRun: args.dryRun,
        registryPath: args.registryPath,
        outputPath: args.outputPath,
        reportPath: args.reportPath,
        sourceDigestSha256,
        extractedFeatureId: "F-004",
        migratedFeatureCount: candidate.features.length,
        issues,
        generatedAt: new Date().toISOString(),
    };

    await writeJsonFile(resolvedReportPath, report);

    if (!args.dryRun && valid) {
        await writeJsonFile(resolvedOutputPath, candidate);
    }

    if (!valid) {
        console.error("F-004 migration validation failed. See report:", args.reportPath);
        process.exitCode = 1;
        return;
    }

    if (args.dryRun) {
        console.log("Dry-run complete. Validation report:", args.reportPath);
        return;
    }

    console.log("Migration complete. Canonical metadata written to:", args.outputPath);
}

void run().catch((error: unknown) => {
    console.error(
        "Migration execution failed:",
        error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
});

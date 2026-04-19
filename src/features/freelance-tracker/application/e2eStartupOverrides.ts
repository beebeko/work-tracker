type StartupOverrideOutcome = "success" | "error";
type CreateOrganizationOverrideOutcome = "success" | "error" | "timeout";

type E2EStartupOverrides = {
    forceFirebaseMode?: boolean;
    bootstrapOutcomes?: StartupOverrideOutcome[];
    bootstrapErrorMessage?: string;
    __bootstrapCallCount?: number;
    createOrganizationOutcomes?: CreateOrganizationOverrideOutcome[];
    createOrganizationErrorMessage?: string;
    createOrganizationTimeoutMs?: number;
    __createOrganizationCallCount?: number;
};

type CreateOrganizationOverride =
    | { type: "pass-through" }
    | { type: "error"; message: string }
    | { type: "timeout" };

function getStartupOverrides(): E2EStartupOverrides | null {
    if (typeof window === "undefined") {
        return null;
    }

    return window.__FREELANCE_E2E_STARTUP__ ?? null;
}

export function resolveFirebaseModeForE2E(defaultMode: boolean): boolean {
    const startupOverrides = getStartupOverrides();

    if (typeof startupOverrides?.forceFirebaseMode === "boolean") {
        return startupOverrides.forceFirebaseMode;
    }

    return defaultMode;
}

export async function maybeRunBootstrapOverride(): Promise<boolean> {
    const startupOverrides = getStartupOverrides();

    if (!startupOverrides?.bootstrapOutcomes) {
        return false;
    }

    const bootstrapOutcomes = startupOverrides.bootstrapOutcomes;
    const currentCallCount = startupOverrides.__bootstrapCallCount ?? 0;
    const outcomeIndex = Math.min(
        currentCallCount,
        Math.max(bootstrapOutcomes.length - 1, 0),
    );
    const outcome = bootstrapOutcomes[outcomeIndex] ?? "success";

    startupOverrides.__bootstrapCallCount = currentCallCount + 1;

    if (outcome === "error") {
        throw new Error(
            startupOverrides.bootstrapErrorMessage ??
                "Startup bootstrap failed (E2E override)",
        );
    }

    return true;
}

export function resolveCreateOrganizationTimeoutMsForE2E(
    defaultTimeoutMs: number,
): number {
    const startupOverrides = getStartupOverrides();
    const overrideTimeoutMs = startupOverrides?.createOrganizationTimeoutMs;

    if (
        typeof overrideTimeoutMs === "number" &&
        Number.isFinite(overrideTimeoutMs) &&
        overrideTimeoutMs > 0
    ) {
        return overrideTimeoutMs;
    }

    return defaultTimeoutMs;
}

export function consumeCreateOrganizationOverrideForE2E(): CreateOrganizationOverride {
    const startupOverrides = getStartupOverrides();

    if (!startupOverrides?.createOrganizationOutcomes) {
        return { type: "pass-through" };
    }

    const createOrganizationOutcomes =
        startupOverrides.createOrganizationOutcomes;
    const currentCallCount =
        startupOverrides.__createOrganizationCallCount ?? 0;
    const outcomeIndex = Math.min(
        currentCallCount,
        Math.max(createOrganizationOutcomes.length - 1, 0),
    );
    const outcome = createOrganizationOutcomes[outcomeIndex] ?? "success";

    startupOverrides.__createOrganizationCallCount = currentCallCount + 1;

    if (outcome === "timeout") {
        return { type: "timeout" };
    }

    if (outcome === "error") {
        return {
            type: "error",
            message:
                startupOverrides.createOrganizationErrorMessage ??
                "Create organization failed (E2E override)",
        };
    }

    return { type: "pass-through" };
}

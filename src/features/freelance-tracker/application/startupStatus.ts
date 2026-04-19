export type SyncStatus = "offline" | "syncing" | "synced" | "bootstrap-error";

export type SyncStatusInput = {
    firebaseMode: boolean;
    isOnline: boolean;
    isLoading: boolean;
    bootstrapError: string | null;
};

export function resolveSyncStatus({
    firebaseMode,
    isOnline,
    isLoading,
    bootstrapError,
}: SyncStatusInput): SyncStatus | null {
    if (!firebaseMode) {
        return null;
    }

    if (bootstrapError) {
        return "bootstrap-error";
    }

    if (!isOnline) {
        return "offline";
    }

    if (isLoading) {
        return "syncing";
    }

    return "synced";
}

export function getSyncStatusLabel(status: SyncStatus): string {
    switch (status) {
        case "offline":
            return "Offline";
        case "syncing":
            return "Syncing";
        case "synced":
            return "Synced";
        case "bootstrap-error":
            return "Bootstrap Error";
    }
}

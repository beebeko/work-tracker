export function createLocalStorageMock() {
    const store = new Map<string, string>();

    return {
        getItem: (key: string): string | null => store.get(key) ?? null,
        setItem: (key: string, value: string): void => {
            store.set(key, value);
        },
        removeItem: (key: string): void => {
            store.delete(key);
        },
        clear: (): void => {
            store.clear();
        },
        key: (index: number): string | null => {
            return Array.from(store.keys())[index] ?? null;
        },
        get length(): number {
            return store.size;
        },
        dump: (): Record<string, string> => Object.fromEntries(store.entries()),
    };
}

export const normalizeCatalogName = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

export const normalizeCatalogKey = (value: string): string =>
    normalizeCatalogName(value).toLowerCase();

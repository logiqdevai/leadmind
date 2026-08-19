export function initialsFromName(name: string | null | undefined): string {
    if (!name?.trim()) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatShortDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}

export function normalizeUrl(raw: string): string {
    const t = raw.trim();
    if (!t) return t;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function profileFieldPatch(next: string, prev: string): string | null | undefined {
    const trimmedNext = next.trim();
    const trimmedPrev = prev.trim();
    if (trimmedNext === trimmedPrev) return undefined;
    return trimmedNext || null;
}

export function emptyToNullOnEdit(value: string, isEdit: boolean): string | null | undefined {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return isEdit ? null : undefined;
}

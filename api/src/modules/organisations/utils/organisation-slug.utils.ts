export function slugifyOrganisationName(name: string, suffix?: string): string {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'org';

    return suffix ? `${base}-${suffix}` : base;
}

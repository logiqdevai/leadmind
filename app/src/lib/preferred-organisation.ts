const STORAGE_KEY = "preferred_organisation:v1";

type PreferredOrganisationMap = Record<string, string>;

function readMap(): PreferredOrganisationMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as PreferredOrganisationMap;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap(map: PreferredOrganisationMap): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
}

export function getPreferredOrganisationUuid(userUuid: string): string | null {
    if (!userUuid) return null;
    return readMap()[userUuid] ?? null;
}

export function setPreferredOrganisationUuid(
    userUuid: string,
    organisationUuid: string,
): void {
    if (!userUuid || !organisationUuid) return;
    const map = readMap();
    map[userUuid] = organisationUuid;
    writeMap(map);
}

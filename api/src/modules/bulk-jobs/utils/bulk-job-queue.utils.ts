export function bulkJobUuidFromQueueData(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const record = data as Record<string, unknown>;
    if (typeof record.bulk_job_uuid === 'string' && record.bulk_job_uuid) {
        return record.bulk_job_uuid;
    }
    const items = record.items;
    if (Array.isArray(items)) {
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const uuid = (item as Record<string, unknown>).bulk_job_uuid;
            if (typeof uuid === 'string' && uuid) return uuid;
        }
    }
    return undefined;
}

export function queueJobIdsFromMetadata(metadata: unknown): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const ids = (metadata as Record<string, unknown>).queue_job_ids;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function contactUuidsFromBatchQueueData(data: unknown): string[] {
    if (!data || typeof data !== 'object') return [];
    const items = (data as Record<string, unknown>).items;
    if (!Array.isArray(items)) return [];
    return items
        .map((item) =>
            item && typeof item === 'object'
                ? (item as Record<string, unknown>).contact_uuid
                : undefined,
        )
        .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0);
}

export function stringArrayFromMetadata(metadata: unknown, key: string): string[] {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const value = (metadata as Record<string, unknown>)[key];
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

export function itemUuidFromQueueData(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const record = data as Record<string, unknown>;
    if (typeof record.contact_uuid === 'string' && record.contact_uuid) {
        return record.contact_uuid;
    }
    if (typeof record.lead_uuid === 'string' && record.lead_uuid) {
        return record.lead_uuid;
    }
    return undefined;
}

export function metadataObject(metadata: unknown): Record<string, unknown> {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return { ...(metadata as Record<string, unknown>) };
    }
    return {};
}

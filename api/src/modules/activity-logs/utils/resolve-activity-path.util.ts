export function resolveActivityPath(
    path: string | undefined,
    sources: {
        params?: Record<string, unknown>;
        body?: Record<string, unknown>;
        result?: unknown;
    },
): string | null {
    if (!path || path === 'none') {
        return null;
    }

    const [root, ...rest] = path.split('.');
    let current: unknown;

    if (root === 'params') {
        current = sources.params;
    } else if (root === 'body') {
        current = sources.body;
    } else if (root === 'result') {
        current = sources.result;
    } else {
        return null;
    }

    for (const key of rest) {
        if (current == null || typeof current !== 'object') {
            return null;
        }
        current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === 'string' && current.trim()) {
        return current;
    }
    if (typeof current === 'number') {
        return String(current);
    }
    return null;
}

export function pickBodyKeys(
    body: unknown,
    keys?: string[],
): Record<string, unknown> | undefined {
    if (!keys?.length || !body || typeof body !== 'object' || Array.isArray(body)) {
        return undefined;
    }
    const source = body as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of keys) {
        if (key in source) {
            picked[key] = source[key];
        }
    }
    return Object.keys(picked).length > 0 ? picked : undefined;
}

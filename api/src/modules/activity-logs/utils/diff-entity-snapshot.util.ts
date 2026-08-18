const EXCLUDED_FIELDS = new Set(['id', 'uuid', 'created_at', 'updated_at']);
const SECRET_FIELD_PATTERN = /password|secret|token|api_?key|private_key/i;
const MAX_VALUE_LENGTH = 2000;

export type EntitySnapshot = Record<string, unknown>;
export type EntityChanges = Record<string, { from: unknown; to: unknown }>;

function normalize(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function serializeForStorage(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
    return `${value.slice(0, MAX_VALUE_LENGTH)}…[truncated]`;
  }
  if (value && typeof value === 'object') {
    const serialized = JSON.stringify(value);
    return serialized.length > MAX_VALUE_LENGTH
      ? `${serialized.slice(0, MAX_VALUE_LENGTH)}…[truncated]`
      : value;
  }
  return value;
}

export function toPrismaDelegateName(entityType: string): string {
  return entityType.replace(/_([a-z])/g, (_, char: string) =>
    char.toUpperCase(),
  );
}

export function diffEntitySnapshots(
  before: EntitySnapshot | null,
  after: EntitySnapshot | null,
): EntityChanges | undefined {
  if (!before && !after) {
    return undefined;
  }

  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changes: EntityChanges = {};

  for (const key of keys) {
    if (EXCLUDED_FIELDS.has(key)) {
      continue;
    }

    const beforeValue = before ? before[key] : undefined;
    const afterValue = after ? after[key] : undefined;

    if (normalize(beforeValue) === normalize(afterValue)) {
      continue;
    }

    const isSecret = SECRET_FIELD_PATTERN.test(key);

    changes[key] = {
      from: isSecret
        ? beforeValue == null
          ? null
          : '[REDACTED]'
        : serializeForStorage(beforeValue),
      to: isSecret
        ? afterValue == null
          ? null
          : '[REDACTED]'
        : serializeForStorage(afterValue),
    };
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

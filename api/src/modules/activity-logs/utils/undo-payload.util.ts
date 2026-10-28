import { ActivityAction } from '../constants/activity-log.constants';
import {
  EXCLUDED_FIELDS,
  EntitySnapshot,
  normalizeValue,
} from './diff-entity-snapshot.util';

/** Rows whose snapshots hold credentials or permissions: never stored, never restorable. */
const UNDO_BLOCKED_ENTITY_TYPES = new Set([
  'api_key',
  'integration',
  'calendar_connection',
  'organisation',
  'organisation_member',
  'organisation_invitation',
]);

/**
 * Actions that are a plain create / edit / delete of one row. Anything with an outside effect
 * (an email sent, an enrichment run, a campaign started) cannot be taken back by restoring a row.
 */
const UNDOABLE_ACTIONS: Set<string> = new Set([
  ActivityAction.CREATED,
  ActivityAction.UPDATED,
  ActivityAction.DELETED,
  ActivityAction.STATUS_UPDATED,
  ActivityAction.TAGS_UPDATED,
  ActivityAction.COMPLETED,
  ActivityAction.RESCHEDULED,
  ActivityAction.MESSAGE_CREATED,
  ActivityAction.MESSAGE_UPDATED,
  ActivityAction.MESSAGE_DELETED,
  ActivityAction.DRAFT_MESSAGE_DELETED,
  ActivityAction.ANALYSIS_CREATED,
  ActivityAction.ANALYSIS_DELETED,
  ActivityAction.CREATED_FROM_CAMPAIGN,
  ActivityAction.CREATED_FROM_MESSAGE,
  ActivityAction.SEQUENCE_CREATED,
]);

/** Join-table relations captured next to a row's own columns, so they can be put back with it. */
export const SNAPSHOT_RELATIONS: Record<string, Record<string, unknown>> = {
  reminder: { assignees: { select: { user_uuid: true } } },
};

const MAX_UNDO_BYTES = 100_000;

export type UndoKind = 'delete' | 'restore' | 'revert';

export interface UndoPayload {
  kind: UndoKind;
  /** restore: every column of the deleted row. */
  snapshot?: Record<string, unknown>;
  /** revert: the previous value of each changed column. */
  values?: Record<string, unknown>;
  /** revert: the value each changed column had after the action, used to detect later edits. */
  expected?: Record<string, unknown>;
  /** Join-table rows before the action (restore / revert). */
  relations?: Record<string, unknown>;
  expected_relations?: Record<string, unknown>;
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as T;
}

export function splitRelations(
  entityType: string,
  snapshot: EntitySnapshot | null,
): { scalars: EntitySnapshot | null; relations: EntitySnapshot } {
  if (!snapshot) {
    return { scalars: null, relations: {} };
  }
  const relationKeys = Object.keys(SNAPSHOT_RELATIONS[entityType] ?? {});
  const scalars: EntitySnapshot = {};
  const relations: EntitySnapshot = {};
  for (const [key, value] of Object.entries(snapshot)) {
    (relationKeys.includes(key) ? relations : scalars)[key] = value;
  }
  return { scalars, relations };
}

export function buildUndoPayload(
  entityType: string,
  action: string,
  before: { scalars: EntitySnapshot | null; relations: EntitySnapshot },
  after: { scalars: EntitySnapshot | null; relations: EntitySnapshot },
): UndoPayload | undefined {
  if (UNDO_BLOCKED_ENTITY_TYPES.has(entityType) || !UNDOABLE_ACTIONS.has(action)) {
    return undefined;
  }

  let payload: UndoPayload | undefined;

  if (!before.scalars && after.scalars) {
    payload = { kind: 'delete' };
  } else if (before.scalars && !after.scalars) {
    payload = {
      kind: 'restore',
      snapshot: jsonSafe(before.scalars),
      relations: jsonSafe(before.relations),
    };
  } else if (before.scalars && after.scalars) {
    const values: Record<string, unknown> = {};
    const expected: Record<string, unknown> = {};
    for (const key of Object.keys(before.scalars)) {
      if (EXCLUDED_FIELDS.has(key)) continue;
      if (
        normalizeValue(before.scalars[key]) !== normalizeValue(after.scalars[key])
      ) {
        values[key] = before.scalars[key];
        expected[key] = after.scalars[key];
      }
    }
    const relationsChanged =
      normalizeValue(before.relations) !== normalizeValue(after.relations);
    if (Object.keys(values).length === 0 && !relationsChanged) {
      return undefined;
    }
    payload = {
      kind: 'revert',
      values: jsonSafe(values),
      expected: jsonSafe(expected),
      ...(relationsChanged && {
        relations: jsonSafe(before.relations),
        expected_relations: jsonSafe(after.relations),
      }),
    };
  }

  if (!payload || JSON.stringify(payload).length > MAX_UNDO_BYTES) {
    return undefined;
  }
  return payload;
}

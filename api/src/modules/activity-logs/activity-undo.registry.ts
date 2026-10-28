import { Injectable } from '@nestjs/common';

/**
 * Entities with side effects beyond their row (queued jobs, calendar events, socket events)
 * register a handler here so an undo goes through their own logic instead of raw row writes.
 * Each method is optional; a missing one falls back to the generic row operation.
 */
export interface ActivityUndoHandler {
  /** Undo of a create. */
  remove?(organisation_uuid: string, uuid: string): Promise<void>;
  /** Undo of a delete. `snapshot` holds every column of the deleted row. */
  restore?(
    organisation_uuid: string,
    snapshot: Record<string, unknown>,
    relations: Record<string, unknown>,
  ): Promise<void>;
  /** Undo of an edit. `values` holds the previous value of each changed column. */
  revert?(
    organisation_uuid: string,
    uuid: string,
    values: Record<string, unknown>,
    relations: Record<string, unknown> | undefined,
  ): Promise<void>;
}

@Injectable()
export class ActivityUndoRegistry {
  private readonly handlers = new Map<string, ActivityUndoHandler>();

  register(entityType: string, handler: ActivityUndoHandler): void {
    this.handlers.set(entityType, handler);
  }

  get(entityType: string): ActivityUndoHandler | undefined {
    return this.handlers.get(entityType);
  }
}

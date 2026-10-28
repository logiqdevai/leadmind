import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { ActivityAction } from './constants/activity-log.constants';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityUndoRegistry } from './activity-undo.registry';
import {
  normalizeValue,
  toPrismaDelegateName,
} from './utils/diff-entity-snapshot.util';
import { UndoPayload } from './utils/undo-payload.util';

type Row = Record<string, unknown>;

interface RowDelegate {
  findUnique(args: unknown): Promise<Row | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
}

@Injectable()
export class ActivityUndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly registry: ActivityUndoRegistry,
  ) {}

  private delegateFor(entityType: string): RowDelegate {
    const delegate = (this.prisma as unknown as Record<string, unknown>)[
      toPrismaDelegateName(entityType)
    ] as RowDelegate | undefined;
    if (!delegate?.findUnique) {
      throw new BadRequestException('This action cannot be undone');
    }
    return delegate;
  }

  async undo(organisation_uuid: string, log_uuid: string, actor_user_uuid: string) {
    const log = await this.prisma.activityLog.findFirst({
      where: { uuid: log_uuid, organisation_uuid },
    });
    if (!log) throw new NotFoundException('Activity not found');

    const metadata = (log.metadata ?? {}) as Row;
    const undo = metadata.undo as UndoPayload | undefined;
    if (!undo || !log.entity_uuid) {
      throw new BadRequestException('This action cannot be undone');
    }
    if (metadata.undone_at) {
      throw new ConflictException('This action has already been undone');
    }

    const entityType = log.entity_type;
    const uuid = log.entity_uuid;
    const delegate = this.delegateFor(entityType);
    const handler = this.registry.get(entityType);
    const current = await delegate.findUnique({ where: { uuid } });

    try {
      if (undo.kind === 'delete') {
        if (!current) {
          throw new ConflictException('It no longer exists, so there is nothing to undo');
        }
        if (handler?.remove) await handler.remove(organisation_uuid, uuid);
        else await delegate.delete({ where: { uuid } });
      } else if (undo.kind === 'restore') {
        if (current) {
          throw new ConflictException('It already exists again, so there is nothing to restore');
        }
        const snapshot = undo.snapshot ?? {};
        if (
          typeof snapshot.organisation_uuid === 'string' &&
          snapshot.organisation_uuid !== organisation_uuid
        ) {
          throw new BadRequestException('This action cannot be undone');
        }
        if (handler?.restore) {
          await handler.restore(organisation_uuid, snapshot, undo.relations ?? {});
        } else {
          // `id` is regenerated; null columns are left to their defaults (Prisma rejects null for Json).
          const data = Object.fromEntries(
            Object.entries(snapshot).filter(([k, v]) => k !== 'id' && v !== null),
          );
          await delegate.create({ data });
        }
      } else {
        if (!current) {
          throw new ConflictException('It has since been deleted, so the change cannot be reverted');
        }
        const changedSince = Object.entries(undo.expected ?? {})
          .filter(([key, value]) => normalizeValue(current[key]) !== normalizeValue(value))
          .map(([key]) => key);
        if (changedSince.length > 0) {
          throw new ConflictException(
            `It was changed again since (${changedSince.join(', ')}), so this change can no longer be reverted`,
          );
        }
        const values = undo.values ?? {};
        if (handler?.revert) {
          await handler.revert(organisation_uuid, uuid, values, undo.relations);
        } else {
          // A Json column that held a value after the action must be cleared with DbNull, not null.
          const data = Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key,
              value === null &&
              typeof undo.expected?.[key] === 'object' &&
              undo.expected[key] !== null
                ? Prisma.DbNull
                : value,
            ]),
          );
          await delegate.update({ where: { uuid }, data });
        }
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ConflictException(
          'Other records depend on this change, so it cannot be undone automatically',
        );
      }
      throw error;
    }

    await this.prisma.activityLog.update({
      where: { uuid: log.uuid },
      data: {
        metadata: {
          ...metadata,
          undone_at: new Date().toISOString(),
          undone_by_user_uuid: actor_user_uuid,
        } as Prisma.InputJsonValue,
      },
    });

    this.activityLogs.log({
      organisation_uuid,
      actor_user_uuid,
      entity_type: entityType,
      entity_uuid: uuid,
      action: ActivityAction.UNDONE,
      summary: log.summary ? `Undid: ${log.summary}` : null,
      metadata: { undone_log_uuid: log.uuid, undone_action: log.action },
    });

    return { undone: true, entity_type: entityType, entity_uuid: uuid };
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
  ACTIVITY_LOG_KEY,
  ActivityAction,
} from '../constants/activity-log.constants';
import { ActivityLogOptions } from '../decorators/activity-log.decorator';
import { ActivityLogsService } from '../activity-logs.service';
import {
  pickBodyKeys,
  resolveActivityPath,
} from '../utils/resolve-activity-path.util';
import {
  diffEntitySnapshots,
  EntitySnapshot,
  toPrismaDelegateName,
} from '../utils/diff-entity-snapshot.util';

const DELETE_ACTIONS: Set<string> = new Set([
  ActivityAction.DELETED,
  ActivityAction.BULK_DELETED,
]);

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityLogsService: ActivityLogsService,
    private readonly prisma: PrismaService,
  ) {}

  private async fetchEntitySnapshot(
    entityType: string,
    uuid: string | null,
  ): Promise<EntitySnapshot | null> {
    if (!uuid) {
      return null;
    }

    const delegateName = toPrismaDelegateName(entityType);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[
      delegateName
    ] as { findUnique?: (args: unknown) => Promise<unknown> } | undefined;

    if (!delegate?.findUnique) {
      return null;
    }

    try {
      const record = await delegate.findUnique({ where: { uuid } });
      return (record as EntitySnapshot | null) ?? null;
    } catch {
      return null;
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const options = this.reflector.get<ActivityLogOptions | undefined>(
      ACTIVITY_LOG_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { uuid?: string; organisation_uuid?: string };
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
      method?: string;
      route?: { path?: string };
      url?: string;
    }>();

    const preEntityUuid = resolveActivityPath(options.entityUuidFrom, {
      params: request.params,
      body: request.body,
    });

    const before = await this.fetchEntitySnapshot(
      options.entityType,
      preEntityUuid,
    );

    return next.handle().pipe(
      tap((result) => {
        const resultOrgUuid =
          typeof result === 'object' &&
          result &&
          'organisation_uuid' in result &&
          typeof (result as { organisation_uuid?: unknown })
            .organisation_uuid === 'string'
            ? (result as { organisation_uuid: string }).organisation_uuid
            : null;

        const resultUuid =
          typeof result === 'object' &&
          result &&
          'uuid' in result &&
          typeof (result as { uuid?: unknown }).uuid === 'string'
            ? (result as { uuid: string }).uuid
            : null;

        let organisation_uuid =
          resolveActivityPath(options.organisationUuidFrom, {
            params: request.params,
            body: request.body,
            result,
          }) ??
          resultOrgUuid ??
          request.user?.organisation_uuid ??
          null;

        if (
          !options.organisationUuidFrom &&
          options.entityType === 'organisation' &&
          resultUuid
        ) {
          organisation_uuid = resultUuid;
        }

        if (!organisation_uuid) {
          return;
        }

        const entity_uuid = resolveActivityPath(
          options.entityUuidFrom ?? 'result.uuid',
          {
            params: request.params,
            body: request.body,
            result,
          },
        );

        const picked = pickBodyKeys(request.body, options.includeBodyKeys);

        void (async () => {
          const after = DELETE_ACTIONS.has(options.action)
            ? null
            : await this.fetchEntitySnapshot(options.entityType, entity_uuid);

          this.activityLogsService.log({
            organisation_uuid,
            actor_user_uuid: request.user?.uuid ?? null,
            entity_type: options.entityType,
            entity_uuid,
            action: options.action,
            summary: options.summary ?? null,
            metadata: {
              method: request.method,
              path: request.route?.path ?? request.url,
              ...(picked ? { body: picked } : {}),
            },
            changes: diffEntitySnapshots(before, after),
          });
        })();
      }),
    );
  }
}

import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { ACTIVITY_LOG_KEY } from '../constants/activity-log.constants';
import { ActivityLogOptions } from '../decorators/activity-log.decorator';
import { ActivityLogsService } from '../activity-logs.service';
import {
    pickBodyKeys,
    resolveActivityPath,
} from '../utils/resolve-activity-path.util';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly activityLogsService: ActivityLogsService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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

        return next.handle().pipe(
            tap((result) => {
                const resultOrgUuid =
                    typeof result === 'object' &&
                    result &&
                    'organisation_uuid' in result &&
                    typeof (result as { organisation_uuid?: unknown }).organisation_uuid ===
                        'string'
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

                const entity_uuid = resolveActivityPath(options.entityUuidFrom ?? 'result.uuid', {
                    params: request.params,
                    body: request.body,
                    result,
                });

                const picked = pickBodyKeys(request.body, options.includeBodyKeys);

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
                });
            }),
        );
    }
}

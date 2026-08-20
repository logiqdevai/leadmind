import { SetMetadata } from '@nestjs/common';
import {
    ACTIVITY_LOG_KEY,
    ActivityAction,
    ActivityEntityType,
} from '../constants/activity-log.constants';

export type ActivityUuidSource =
    | 'params.uuid'
    | 'params.lead_uuid'
    | 'params.message_uuid'
    | 'params.fieldUuid'
    | 'params.infoUuid'
    | 'params.completionUuid'
    | 'params.analysisUuid'
    | 'params.contactUuid'
    | 'params.userUuid'
    | 'params.invitationUuid'
    | 'params.token'
    | 'params.step_uuid'
    | 'params.enrollment_uuid'
    | 'body.uuid'
    | 'result.uuid'
    | 'result.jobId'
    | 'none';

export interface ActivityLogOptions {
    entityType: ActivityEntityType | string;
    action: ActivityAction | string;
    entityUuidFrom?: ActivityUuidSource;
    organisationUuidFrom?: ActivityUuidSource;
    summary?: string;
    includeBodyKeys?: string[];
}

export const ActivityLog = (options: ActivityLogOptions) =>
    SetMetadata(ACTIVITY_LOG_KEY, options);

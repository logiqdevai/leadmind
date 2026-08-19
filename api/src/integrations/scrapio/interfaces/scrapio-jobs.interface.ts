import { ScrapioListQuery } from './scrapio-common.interface';

export type JobLogStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'DELAYED'
  | 'PAUSED'
  | 'STALLED';

export interface JobLog {
  id: string;
  queue_name: string;
  job_id: string | null;
  job_name: string | null;
  status: JobLogStatus;
  attempt: number;
  max_attempts: number | null;
  workflow_run_id: string | null;
  user_id: string | null;
  payload: Record<string, any> | null;
  result: Record<string, any> | null;
  error_message: string | null;
  stack_trace: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface DeleteJobLogsDto {
  job_ids: string[];
}

export interface JobsListQuery extends ScrapioListQuery {
  date_to?: string;
  date_from?: string;
  user_id?: string;
  queue_name?: string;
  status?: JobLogStatus;
}

import { SendingPeriodUnit } from '@/generated/prisma';

export interface ResolvedStage {
  stage: {
    uuid: string;
    order_index: number;
    limit: number;
    period_unit: SendingPeriodUnit;
    duration_value: number | null;
    duration_unit: SendingPeriodUnit | null;
  };
  stage_index: number;
  stage_started_at: Date;
  stage_elapsed_ms: number;
  next_stage_at: Date | null;
  is_final_stage: boolean;
}

export interface SchedulePreviewEntry {
  stage_index: number;
  order_index: number;
  limit: number;
  period_unit: SendingPeriodUnit;
  starts_at: Date;
  ends_at: Date | null;
  is_final_stage: boolean;
  estimated_messages: number;
}

export interface SchedulePreviewResult {
  entries: SchedulePreviewEntry[];
  estimated_completion_at: Date | null;
  total_contacts: number;
}

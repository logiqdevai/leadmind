export type SendingCapacityDenialReason =
  | 'stage_limit'
  | 'account_limit'
  | 'provider_limit'
  | 'min_interval'
  | 'window_closed'
  | 'no_active_policy';

export class SendingCapacityDeniedError extends Error {
  constructor(public readonly reason: SendingCapacityDenialReason) {
    super(`Sending capacity denied: ${reason}`);
    this.name = 'SendingCapacityDeniedError';
  }
}

export interface EligibilityResult {
  eligible: boolean;
  next_eligible_at: Date;
  reason?: SendingCapacityDenialReason;
  stage_remaining: number;
}

export interface CapacityObservability {
  campaign_integration_uuid: string;
  current_stage: {
    order_index: number;
    limit: number;
    period_unit: string;
    is_final_stage: boolean;
  } | null;
  stage_used: number | null;
  stage_remaining: number | null;
  account_limit: number | null;
  account_used: number | null;
  account_remaining: number | null;
  provider_limit: number | null;
  provider_used: number | null;
  provider_remaining: number | null;
  effective_limit: number | null;
  sending_window: {
    start_minute: number | null;
    end_minute: number | null;
    timezone: string;
  };
  next_eligible_at: Date;
}

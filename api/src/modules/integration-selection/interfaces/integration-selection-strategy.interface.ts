export interface SelectableCampaignIntegration {
  campaign_integration_uuid: string;
  /** Remaining messages in the current stage's active period, from SendingCapacityService. */
  stage_remaining: number;
}

export const INTEGRATION_SELECTION_STRATEGY = 'INTEGRATION_SELECTION_STRATEGY';

/** Swap point for future selection strategies (round-robin, weighted, warm-up-aware, ...). */
export interface IntegrationSelectionStrategy {
  select(
    candidates: SelectableCampaignIntegration[],
  ): SelectableCampaignIntegration | null;
}

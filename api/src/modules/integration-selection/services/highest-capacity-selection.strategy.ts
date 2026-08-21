import { Injectable } from '@nestjs/common';
import {
  IntegrationSelectionStrategy,
  SelectableCampaignIntegration,
} from '../interfaces/integration-selection-strategy.interface';

/**
 * v1 deterministic strategy: pick the eligible campaign integration with the most
 * remaining capacity in its current stage period. Naturally balances load across
 * accounts with different stage limits. Ties broken by campaign_integration_uuid
 * for determinism across ticks.
 */
@Injectable()
export class HighestCapacitySelectionStrategy
  implements IntegrationSelectionStrategy
{
  select(
    candidates: SelectableCampaignIntegration[],
  ): SelectableCampaignIntegration | null {
    const eligible = candidates.filter((c) => c.stage_remaining > 0);
    if (eligible.length === 0) return null;

    return eligible.reduce((best, current) => {
      if (current.stage_remaining > best.stage_remaining) return current;
      if (
        current.stage_remaining === best.stage_remaining &&
        current.campaign_integration_uuid < best.campaign_integration_uuid
      ) {
        return current;
      }
      return best;
    });
  }
}

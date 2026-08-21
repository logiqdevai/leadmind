import { Inject, Injectable } from '@nestjs/common';
import {
  INTEGRATION_SELECTION_STRATEGY,
  IntegrationSelectionStrategy,
  SelectableCampaignIntegration,
} from '../interfaces/integration-selection-strategy.interface';

/** Thin wrapper injecting the active strategy - the swap point for future strategies. */
@Injectable()
export class IntegrationSelectionService {
  constructor(
    @Inject(INTEGRATION_SELECTION_STRATEGY)
    private readonly strategy: IntegrationSelectionStrategy,
  ) {}

  select(
    candidates: SelectableCampaignIntegration[],
  ): SelectableCampaignIntegration | null {
    return this.strategy.select(candidates);
  }
}

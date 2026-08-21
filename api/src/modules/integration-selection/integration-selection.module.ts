import { Module } from '@nestjs/common';
import { INTEGRATION_SELECTION_STRATEGY } from './interfaces/integration-selection-strategy.interface';
import { HighestCapacitySelectionStrategy } from './services/highest-capacity-selection.strategy';
import { IntegrationSelectionService } from './services/integration-selection.service';

@Module({
  providers: [
    HighestCapacitySelectionStrategy,
    {
      provide: INTEGRATION_SELECTION_STRATEGY,
      useClass: HighestCapacitySelectionStrategy,
    },
    IntegrationSelectionService,
  ],
  exports: [IntegrationSelectionService],
})
export class IntegrationSelectionModule {}

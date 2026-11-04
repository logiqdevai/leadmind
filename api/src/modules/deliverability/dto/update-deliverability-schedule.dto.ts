import { PartialType } from '@nestjs/swagger';
import { CreateDeliverabilityScheduleDto } from './create-deliverability-schedule.dto';

/** Every field optional. Sending `from` or `custom_domain` re-targets the schedule. */
export class UpdateDeliverabilityScheduleDto extends PartialType(
  CreateDeliverabilityScheduleDto,
) {}

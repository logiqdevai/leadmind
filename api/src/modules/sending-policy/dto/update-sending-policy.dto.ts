import { PartialType, PickType } from '@nestjs/swagger';
import { CreateSendingPolicyDto } from './create-sending-policy.dto';

export class UpdateSendingPolicyDto extends PartialType(
  PickType(CreateSendingPolicyDto, [
    'name',
    'description',
    'timezone',
    'window_start_minute',
    'window_end_minute',
    'min_interval_seconds',
    'min_interval_jitter_seconds',
  ] as const),
) {}

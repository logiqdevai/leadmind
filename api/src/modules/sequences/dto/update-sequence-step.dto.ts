import { PartialType } from '@nestjs/swagger';
import { CreateSequenceStepDto } from './create-sequence-step.dto';

export class UpdateSequenceStepDto extends PartialType(CreateSequenceStepDto) {}

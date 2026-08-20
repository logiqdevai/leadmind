import { PartialType } from '@nestjs/swagger';
import { CreateSequenceDto } from './create-sequence.dto';

export class UpdateSequenceDto extends PartialType(CreateSequenceDto) {}

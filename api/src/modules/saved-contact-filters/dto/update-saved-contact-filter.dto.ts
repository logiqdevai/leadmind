import { PartialType } from '@nestjs/swagger';
import { CreateSavedContactFilterDto } from './create-saved-contact-filter.dto';

export class UpdateSavedContactFilterDto extends PartialType(CreateSavedContactFilterDto) { }

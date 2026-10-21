import { PartialType } from '@nestjs/swagger';
import { CreateOrgTagDto } from './create-org-tag.dto';

export class UpdateOrgTagDto extends PartialType(CreateOrgTagDto) {}

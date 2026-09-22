import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CampaignFiltersDto } from './campaign-filters.dto';

export class PreviewContactsDto {
    @ApiProperty({ type: CampaignFiltersDto })
    @ValidateNested()
    @Type(() => CampaignFiltersDto)
    filters: CampaignFiltersDto;
}

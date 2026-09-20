import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ContactAudienceStatsService } from './contact-audience-stats.service';
import { ContactAudienceStatsQueryDto } from './dto/contact-audience-stats-query.dto';

@ApiTags('audience-stats')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('audience-stats')
export class ContactAudienceStatsController {
    constructor(private readonly contactAudienceStatsService: ContactAudienceStatsService) {}

    @Get()
    @ApiOperation({ summary: 'CRM audience analytics across every contact in the organisation' })
    getStats(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ContactAudienceStatsQueryDto,
    ) {
        return this.contactAudienceStatsService.getOrganisationStats(organisation_uuid, query);
    }
}

import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ContactAudienceStatsService } from './contact-audience-stats.service';
import { ContactAudienceStatsQueryDto } from './dto/contact-audience-stats-query.dto';
import { ContactAudienceAnalysisService } from './contact-audience-analysis.service';
import { ListContactAudienceAnalysesDto } from './dto/list-contact-audience-analyses.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('audience-stats')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('audience-stats')
export class ContactAudienceStatsController {
    constructor(
        private readonly contactAudienceStatsService: ContactAudienceStatsService,
        private readonly contactAudienceAnalysisService: ContactAudienceAnalysisService,
    ) {}

    @Get()
    @ApiOperation({ summary: 'CRM audience analytics across every contact in the organisation' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getStats(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ContactAudienceStatsQueryDto,
    ) {
        return this.contactAudienceStatsService.getOrganisationStats(organisation_uuid, query);
    }

    @Get('analyses')
    @ApiOperation({ summary: 'List AI audience analyses for the whole CRM' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    listAnalyses(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListContactAudienceAnalysesDto,
    ) {
        return this.contactAudienceAnalysisService.listOrganisationAnalyses(organisation_uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_CREATED })
    @Post('analyses')
    @ApiOperation({ summary: 'Run a new AI audience analysis across the whole CRM' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    createAnalysis(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.contactAudienceAnalysisService.createOrganisationAnalysis(organisation_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_DELETED, entityUuidFrom: 'params.analysisUuid' })
    @Delete('analyses/:analysisUuid')
    @ApiOperation({ summary: 'Delete an AI audience analysis for the whole CRM' })
    @ApiParam({ name: 'analysisUuid', description: 'Audience analysis uuid' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Analysis not found' })
    deleteAnalysis(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('analysisUuid') analysisUuid: string,
    ) {
        return this.contactAudienceAnalysisService.deleteOrganisationAnalysis(organisation_uuid, analysisUuid);
    }
}

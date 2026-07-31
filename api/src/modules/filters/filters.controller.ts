import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { FiltersService } from './filters.service';
import { CreateFilterDto } from './dto/create-filter.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';
import { ListJobsDto } from './dto/list-jobs.dto';
import { ContactAudienceStatsService } from '@/modules/contact-audience-stats/contact-audience-stats.service';
import { ContactAudienceAnalysisService } from '@/modules/contact-audience-stats/contact-audience-analysis.service';
import { ContactAudienceStatsQueryDto } from '@/modules/contact-audience-stats/dto/contact-audience-stats-query.dto';
import { ListContactAudienceAnalysesDto } from '@/modules/contact-audience-stats/dto/list-contact-audience-analyses.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('filters')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('filters')
export class FiltersController {
    constructor(
        private readonly filtersService: FiltersService,
        private readonly contactAudienceStatsService: ContactAudienceStatsService,
        private readonly contactAudienceAnalysisService: ContactAudienceAnalysisService,
    ) { }

    @ActivityLog({ entityType: ActivityEntityType.FILTER, action: ActivityAction.CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiOperation({ summary: 'Create a filter' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateFilterDto) {
        return this.filtersService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List filters for the current user' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.filtersService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a filter by uuid' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.filtersService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.FILTER, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a filter' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateFilterDto,
    ) {
        return this.filtersService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.FILTER, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a filter' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.filtersService.remove(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.FILTER, action: ActivityAction.RUN_STARTED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/run')
    @ApiOperation({ summary: 'Manually enqueue a scrape job for a filter' })
    manualRun(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.filtersService.manualRun(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.FILTER, action: ActivityAction.RUN_STOPPED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/stop')
    @ApiOperation({ summary: 'Stop a running or queued scrape job for a filter' })
    stop(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.filtersService.stop(organisation_uuid, uuid);
    }

    @Get(':uuid/jobs')
    @ApiOperation({ summary: 'List FilterJob records for a filter (paginated)' })
    findJobs(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ListJobsDto,
    ) {
        return this.filtersService.findJobs(organisation_uuid, uuid, query);
    }

    @Get(':uuid/stats')
    @ApiOperation({ summary: 'CRM and activity analytics for contacts in a filter' })
    getStats(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ContactAudienceStatsQueryDto,
    ) {
        return this.contactAudienceStatsService.getFilterStats(organisation_uuid, uuid, query);
    }

    @Get(':uuid/analyses')
    @ApiOperation({ summary: 'List AI audience analyses for a filter' })
    listAnalyses(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ListContactAudienceAnalysesDto,
    ) {
        return this.contactAudienceAnalysisService.listFilterAnalyses(organisation_uuid, uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_CREATED })
    @Post(':uuid/analyses')
    @ApiOperation({ summary: 'Run a new AI audience analysis for a filter (full history stats)' })
    createAnalysis(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.contactAudienceAnalysisService.createFilterAnalysis(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_DELETED, entityUuidFrom: 'params.analysisUuid' })
    @Delete(':uuid/analyses/:analysisUuid')
    @ApiOperation({ summary: 'Delete an AI audience analysis for a filter' })
    deleteAnalysis(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Param('analysisUuid') analysisUuid: string,
    ) {
        return this.contactAudienceAnalysisService.deleteFilterAnalysis(organisation_uuid, uuid, analysisUuid);
    }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { BulkJobsService } from './bulk-jobs.service';
import { BulkJobUuidsDto } from './dto/bulk-job-uuids.dto';
import { ListBulkJobsDto } from './dto/list-bulk-jobs.dto';

@ApiTags('bulk-jobs')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('bulk-jobs')
export class BulkJobsController {
    constructor(private readonly bulkJobsService: BulkJobsService) {}

    @Get()
    @ApiOperation({ summary: 'List bulk/queue jobs for the current organisation' })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListBulkJobsDto,
    ) {
        return this.bulkJobsService.findAll(organisation_uuid, query);
    }

    @Post('cancel')
    @ApiOperation({ summary: 'Cancel selected bulk jobs and stop their queue work' })
    cancel(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: BulkJobUuidsDto,
    ) {
        return this.bulkJobsService.cancelMany(organisation_uuid, dto.uuids);
    }

    @Post('retry')
    @ApiOperation({
        summary: 'Retry selected cancelled/failed bulk jobs from the latest successful progress',
    })
    retry(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: BulkJobUuidsDto,
    ) {
        return this.bulkJobsService.retryMany(organisation_uuid, dto.uuids);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single bulk job' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.bulkJobsService.findOne(organisation_uuid, uuid);
    }
}

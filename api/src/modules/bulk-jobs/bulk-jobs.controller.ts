import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { BulkJobsService } from './bulk-jobs.service';
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

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single bulk job' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.bulkJobsService.findOne(organisation_uuid, uuid);
    }
}

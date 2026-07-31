import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLogsService } from './activity-logs.service';
import { ListActivityLogsDto } from './dto/list-activity-logs.dto';

@ApiTags('activity-logs')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('activity-logs')
export class ActivityLogsController {
    constructor(private readonly activityLogsService: ActivityLogsService) {}

    @Get()
    @ApiOperation({ summary: 'List organisation activity logs' })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Query() query: ListActivityLogsDto,
    ) {
        return this.activityLogsService.findAll(organisation_uuid, query);
    }
}

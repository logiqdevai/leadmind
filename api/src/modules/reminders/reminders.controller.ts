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
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('reminders')
export class RemindersController {
    constructor(private readonly remindersService: RemindersService) {}

    @ActivityLog({ entityType: ActivityEntityType.REMINDER, action: ActivityAction.CREATED })
    @Post()
    @ApiOperation({ summary: 'Create a reminder for a contact' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateReminderDto) {
        return this.remindersService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List reminders with optional filters' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListRemindersDto) {
        return this.remindersService.findAll(organisation_uuid, query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Reminder statistics: pending, due today, overdue, completed this week' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getStats(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.remindersService.getUpcomingStats(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single reminder' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.REMINDER, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a reminder (reschedule, edit title/notes, change status)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateReminderDto,
    ) {
        return this.remindersService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.REMINDER, action: ActivityAction.COMPLETED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid/complete')
    @ApiOperation({ summary: 'Mark a reminder as completed' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    complete(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.complete(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.REMINDER, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a reminder and cancel its scheduled job' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.remove(organisation_uuid, uuid);
    }
}

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
    ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ListRemindersDto } from './dto/list-reminders.dto';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('reminders')
export class RemindersController {
    constructor(private readonly remindersService: RemindersService) {}

    @Post()
    @ApiOperation({ summary: 'Create a reminder for a contact' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateReminderDto) {
        return this.remindersService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List reminders with optional filters' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListRemindersDto) {
        return this.remindersService.findAll(organisation_uuid, query);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Reminder statistics: pending, due today, overdue, completed this week' })
    getStats(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.remindersService.getUpcomingStats(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single reminder' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.findOne(organisation_uuid, uuid);
    }

    @Put(':uuid')
    @ApiOperation({ summary: 'Update a reminder (reschedule, edit title/notes, change status)' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateReminderDto,
    ) {
        return this.remindersService.update(organisation_uuid, uuid, dto);
    }

    @Put(':uuid/complete')
    @ApiOperation({ summary: 'Mark a reminder as completed' })
    complete(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.complete(organisation_uuid, uuid);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a reminder and cancel its scheduled job' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.remove(organisation_uuid, uuid);
    }
}

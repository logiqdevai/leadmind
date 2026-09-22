import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { RemindersService } from '@/modules/reminders/reminders.service';
import { CreateReminderDto } from '@/modules/reminders/dto/create-reminder.dto';
import { UpdateReminderDto } from '@/modules/reminders/dto/update-reminder.dto';
import { ListRemindersDto } from '@/modules/reminders/dto/list-reminders.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/reminders')
export class PublicRemindersController {
    constructor(private readonly remindersService: RemindersService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post()
    @ApiOperation({ summary: 'Create a reminder for a contact' })
    @ApiResponse({ status: 201 })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateReminderDto) {
        return this.remindersService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List reminders with optional filters' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListRemindersDto) {
        return this.remindersService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single reminder' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.findOne(organisation_uuid, uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a reminder (reschedule, edit title/notes, change status)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateReminderDto,
    ) {
        return this.remindersService.update(organisation_uuid, uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post(':uuid/complete')
    @ApiOperation({ summary: 'Mark a reminder as completed' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    complete(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.complete(organisation_uuid, uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a reminder and cancel its scheduled job' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.remindersService.remove(organisation_uuid, uuid);
    }
}

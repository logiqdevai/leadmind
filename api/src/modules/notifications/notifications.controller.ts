import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    @ApiOperation({ summary: 'List the caller notifications, newest first' })
    @ApiResponse({ status: 200 })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Query() query: ListNotificationsDto,
    ) {
        return this.notificationsService.findAll(organisation_uuid, user_uuid, query);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Number of unread notifications for the caller' })
    @ApiResponse({ status: 200 })
    unreadCount(@CurrentUser('organisation_uuid') organisation_uuid: string, @CurrentUser('uuid') user_uuid: string) {
        return this.notificationsService.unreadCount(organisation_uuid, user_uuid);
    }

    @Post('read-all')
    @ApiOperation({ summary: 'Mark every notification as read' })
    @ApiResponse({ status: 201 })
    markAllRead(@CurrentUser('organisation_uuid') organisation_uuid: string, @CurrentUser('uuid') user_uuid: string) {
        return this.notificationsService.markAllRead(organisation_uuid, user_uuid);
    }

    @Post(':uuid/read')
    @ApiOperation({ summary: 'Mark a notification as read' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    markRead(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.notificationsService.markRead(organisation_uuid, user_uuid, uuid);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a notification' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Notification not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.notificationsService.remove(organisation_uuid, user_uuid, uuid);
    }
}

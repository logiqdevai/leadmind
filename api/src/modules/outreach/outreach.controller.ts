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
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { MsgStatus } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ListMessagesDto } from './dto/list-messages.dto';
import { SendOutreachDto } from './dto/send-outreach.dto';
import { SendExistingMessageDto } from './dto/email-provider.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { OutreachService } from './outreach.service';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('outreach')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('outreach')
export class OutreachController {
    constructor(private readonly outreachService: OutreachService) { }

    @Get('messages')
    @ApiOperation({ summary: 'List outreach messages for current user' })
    @ApiQuery({ name: 'contact_uuid', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, enum: MsgStatus })
    @ApiResponse({ status: 200 })
    listMessages(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListMessagesDto) {
        return this.outreachService.listMessages(organisation_uuid, query);
    }

    @Get('messages/:uuid/thread')
    @ApiOperation({ summary: 'Get the original message plus its full ordered event/reply history' })
    @ApiResponse({ status: 200 })
    getThread(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') message_uuid: string,
    ) {
        return this.outreachService.getThread(organisation_uuid, message_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.OUTREACH_MESSAGE, action: ActivityAction.MESSAGE_UPDATED, entityUuidFrom: 'params.uuid' })
    @Put('messages/:uuid')
    @ApiOperation({ summary: 'Update pending outreach message' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 409, description: 'Only pending messages can be edited' })
    updateMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') message_uuid: string,
        @Body() dto: UpdateMessageDto,
    ) {
        return this.outreachService.updateMessage(organisation_uuid, message_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.OUTREACH_MESSAGE, action: ActivityAction.MESSAGE_SENT, entityUuidFrom: 'params.uuid' })
    @Post('messages/:uuid/send')
    @ApiOperation({ summary: 'Enqueue outreach message for sending (or retry a failed message)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'Only pending or failed messages can be sent' })
    sendMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') message_uuid: string,
        @Body() dto: SendExistingMessageDto = {},
    ) {
        return this.outreachService.sendMessage(organisation_uuid, message_uuid, dto, user_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.OUTREACH_MESSAGE, action: ActivityAction.MESSAGE_DELETED, entityUuidFrom: 'params.uuid' })
    @Delete('messages/:uuid')
    @ApiOperation({ summary: 'Delete pending outreach message' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 409, description: 'Only pending messages can be deleted' })
    async deleteMessage(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') message_uuid: string) {
        await this.outreachService.deleteMessage(organisation_uuid, message_uuid);
        return { deleted: true };
    }

    @ActivityLog({ entityType: ActivityEntityType.OUTREACH_MESSAGE, action: ActivityAction.MESSAGE_CREATED })
    @Post('messages')
    @ApiOperation({ summary: 'Create and enqueue outreach message' })
    @ApiResponse({ status: 201 })
    createAndQueue(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: SendOutreachDto,
    ) {
        return this.outreachService.createAndQueue(organisation_uuid, dto, user_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.OUTREACH_MESSAGE, action: ActivityAction.MESSAGE_DRAFTED })
    @Post('messages/draft')
    @ApiOperation({ summary: 'Create a PENDING outreach message without queueing it for send' })
    @ApiResponse({ status: 201 })
    createDraft(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: SendOutreachDto,
    ) {
        return this.outreachService.createDraft(organisation_uuid, dto, user_uuid);
    }
}

import { Body, Controller, Delete, Get, Param, Put, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Channel, OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { OutreachService } from '@/modules/outreach/outreach.service';
import { ListMessagesDto } from '@/modules/outreach/dto/list-messages.dto';
import { SendExistingMessageDto } from '@/modules/outreach/dto/email-provider.dto';
import { UpdateMessageDto } from '@/modules/outreach/dto/update-message.dto';
import { PublicSendEmailDto } from './dto/public-send-email.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/outreach')
export class PublicOutreachController {
    constructor(private readonly outreachService: OutreachService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post('messages')
    @ApiOperation({ summary: 'Create and enqueue an outreach email to a contact' })
    @ApiResponse({ status: 201 })
    createAndQueue(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Body() dto: PublicSendEmailDto,
    ) {
        return this.outreachService.createAndQueue(
            organisation_uuid,
            { ...dto, channel: Channel.EMAIL },
            user_uuid,
        );
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post('messages/draft')
    @ApiOperation({ summary: 'Create a PENDING outreach email without queueing it for send' })
    @ApiResponse({ status: 201 })
    createDraft(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Body() dto: PublicSendEmailDto,
    ) {
        return this.outreachService.createDraft(
            organisation_uuid,
            { ...dto, channel: Channel.EMAIL },
            user_uuid,
        );
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post('messages/:uuid/send')
    @ApiOperation({ summary: 'Enqueue an existing/draft outreach message for sending (or retry a failed one)' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'Only pending or failed messages can be sent' })
    sendMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Param('uuid') message_uuid: string,
        @Body() dto: SendExistingMessageDto = {},
    ) {
        return this.outreachService.sendMessage(organisation_uuid, message_uuid, dto, user_uuid);
    }

    @Get('messages')
    @ApiOperation({ summary: 'List outreach messages' })
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

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Put('messages/:uuid')
    @ApiOperation({ summary: 'Update a pending outreach message' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 409, description: 'Only pending messages can be edited' })
    updateMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') message_uuid: string,
        @Body() dto: UpdateMessageDto,
    ) {
        return this.outreachService.updateMessage(organisation_uuid, message_uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete('messages/:uuid')
    @ApiOperation({ summary: 'Delete a pending outreach message' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 409, description: 'Only pending messages can be deleted' })
    async deleteMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') message_uuid: string,
    ) {
        await this.outreachService.deleteMessage(organisation_uuid, message_uuid);
        return { deleted: true };
    }
}

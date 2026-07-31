import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
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
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { ListCampaignContactsDto } from './dto/list-campaign-contacts.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { GenerateCampaignMessageDto } from './dto/generate-campaign-message.dto';
import { PreviewContactsDto } from './dto/preview-contacts.dto';
import { ListDraftMessagesDto } from './dto/list-draft-messages.dto';
import { StartCampaignDto, SendCampaignDraftsDto } from './dto/email-provider-campaign.dto';
import { SendExistingMessageDto } from '@/modules/outreach/dto/email-provider.dto';
import { MarketingCampaignsService } from './services/marketing-campaigns.service';

@ApiTags('marketing-campaigns')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('marketing-campaigns')
export class MarketingCampaignsController {
    constructor(private readonly service: MarketingCampaignsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a draft marketing campaign' })
    @ApiResponse({ status: 201 })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateCampaignDto) {
        return this.service.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List marketing campaigns' })
    list(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListCampaignsDto) {
        return this.service.list(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get campaign detail with full stats' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.service.findOne(organisation_uuid, uuid);
    }

    @Patch(':uuid')
    @ApiOperation({ summary: 'Update DRAFT campaign' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: UpdateCampaignDto,
    ) {
        return this.service.update(organisation_uuid, uuid, dto);
    }

    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a draft / cancelled / completed / failed campaign' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.service.remove(organisation_uuid, uuid);
    }

    @Get(':uuid/contacts')
    @ApiOperation({ summary: 'List campaign recipients with statuses' })
    listContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Query() query: ListCampaignContactsDto,
    ) {
        return this.service.listContacts(organisation_uuid, uuid, query);
    }

    @Post(':uuid/preview-contacts')
    @ApiOperation({ summary: 'Preview the matched contact set for a filter (no persistence)' })
    previewContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: PreviewContactsDto,
    ) {
        return this.service.previewContacts(organisation_uuid, uuid, dto);
    }

    @Post(':uuid/start')
    @ApiOperation({ summary: 'Start a draft campaign (immediate or at scheduled_at)' })
    start(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: StartCampaignDto,
    ) {
        return this.service.start(organisation_uuid, uuid, dto);
    }

    @Post(':uuid/schedule')
    @ApiOperation({ summary: 'Set scheduled_at and queue dispatch' })
    schedule(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: ScheduleCampaignDto,
    ) {
        return this.service.schedule(organisation_uuid, uuid, dto);
    }

    @Post(':uuid/duplicate')
    @ApiOperation({ summary: 'Duplicate a campaign as a new DRAFT' })
    duplicate(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.service.duplicate(organisation_uuid, uuid);
    }

    @Post(':uuid/rerun')
    @ApiOperation({ summary: 'Re-run a completed, cancelled, or failed campaign from scratch' })
    rerun(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.service.rerun(organisation_uuid, uuid);
    }

    @Post(':uuid/cancel')
    @ApiOperation({ summary: 'Cancel a sending or scheduled campaign' })
    cancel(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
    ) {
        return this.service.cancel(organisation_uuid, uuid);
    }

    @Post(':uuid/ai/generate')
    @ApiOperation({ summary: 'AI generate / improve / shorten / re-tone a campaign message' })
    generate(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: GenerateCampaignMessageDto,
    ) {
        return this.service.generateMessage(organisation_uuid, uuid, dto);
    }

    @Post(':uuid/send-drafts')
    @ApiOperation({ summary: 'Send pre-generated personalized drafts for a DRAFTS_READY campaign' })
    sendPersonalizedDrafts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Body() dto: SendCampaignDraftsDto,
    ) {
        return this.service.sendPersonalizedDrafts(organisation_uuid, uuid, dto);
    }

    @Get(':uuid/draft-messages')
    @ApiOperation({ summary: 'List per-contact draft messages for a PERSONALIZED campaign' })
    listDraftMessages(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Query() query: ListDraftMessagesDto,
    ) {
        return this.service.listDraftMessages(organisation_uuid, uuid, query);
    }

    @Delete(':uuid/draft-messages/:message_uuid')
    @ApiOperation({ summary: 'Delete a campaign outreach row (any status, e.g. remove bad or sent rows from the list)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404 })
    deleteDraftMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Param('message_uuid', ParseUUIDPipe) message_uuid: string,
    ) {
        return this.service.deleteDraftMessage(organisation_uuid, uuid, message_uuid);
    }

    @Post(':uuid/draft-messages/:message_uuid/send')
    @ApiOperation({ summary: 'Queue a single campaign draft message for send' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404 })
    @ApiResponse({ status: 409 })
    sendDraftMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid', ParseUUIDPipe) uuid: string,
        @Param('message_uuid', ParseUUIDPipe) message_uuid: string,
        @Body() dto: SendExistingMessageDto = {},
    ) {
        return this.service.sendDraftMessage(organisation_uuid, uuid, message_uuid, dto);
    }
}

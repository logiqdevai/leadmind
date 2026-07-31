import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { MessageTemplatesService } from './message-templates.service';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { CreateTemplateFromSourceDto } from './dto/create-template-from-source.dto';
import { GenerateTemplateMessageDto } from './dto/generate-template-message.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('message-templates')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('message-templates')
export class MessageTemplatesController {
    constructor(private readonly messageTemplatesService: MessageTemplatesService) {}

    @Post('ai/generate')
    @ApiOperation({ summary: 'Generate or refine template content with AI' })
    generateAi(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: GenerateTemplateMessageDto) {
        return this.messageTemplatesService.generateAi(organisation_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.MESSAGE_TEMPLATE, action: ActivityAction.CREATED_FROM_CAMPAIGN })
    @Post('from-campaign/:campaign_uuid')
    @ApiOperation({ summary: 'Create a template from an existing campaign message' })
    createFromCampaign(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('campaign_uuid') campaign_uuid: string,
        @Body() dto: CreateTemplateFromSourceDto,
    ) {
        return this.messageTemplatesService.createFromCampaign(organisation_uuid, campaign_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.MESSAGE_TEMPLATE, action: ActivityAction.CREATED_FROM_MESSAGE })
    @Post('from-message/:message_uuid')
    @ApiOperation({ summary: 'Create a template from an existing outreach message' })
    createFromMessage(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('message_uuid') message_uuid: string,
        @Body() dto: CreateTemplateFromSourceDto,
    ) {
        return this.messageTemplatesService.createFromMessage(organisation_uuid, message_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.MESSAGE_TEMPLATE, action: ActivityAction.CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiOperation({ summary: 'Create a message template' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateMessageTemplateDto) {
        return this.messageTemplatesService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List message templates for the current user' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.messageTemplatesService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a message template by uuid' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.messageTemplatesService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.MESSAGE_TEMPLATE, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a message template' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateMessageTemplateDto,
    ) {
        return this.messageTemplatesService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.MESSAGE_TEMPLATE, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a message template' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.messageTemplatesService.remove(organisation_uuid, uuid);
    }
}

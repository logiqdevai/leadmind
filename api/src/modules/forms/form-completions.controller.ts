import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { FormCompletionsService } from './form-completions.service';
import { CreateFormCompletionDto } from './dto/create-form-completion.dto';
import { UpdateFormCompletionDto } from './dto/update-form-completion.dto';
import { ListFormCompletionsDto } from './dto/list-form-completions.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('forms/:uuid/completions')
export class FormCompletionsController {
    constructor(private readonly formCompletionsService: FormCompletionsService) {}

    @ActivityLog({ entityType: ActivityEntityType.FORM_COMPLETION, action: ActivityAction.CREATED })
    @Post()
    @ApiOperation({ summary: 'Create a form completion' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: CreateFormCompletionDto,
    ) {
        return this.formCompletionsService.create(organisation_uuid, user_uuid, form_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List completions for a form' })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Query() query: ListFormCompletionsDto,
    ) {
        return this.formCompletionsService.findAll(organisation_uuid, form_uuid, query);
    }

    @Get(':completionUuid')
    @ApiOperation({ summary: 'Get a single completion with all values' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('completionUuid') completion_uuid: string,
    ) {
        return this.formCompletionsService.findOne(organisation_uuid, form_uuid, completion_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.FORM_COMPLETION, action: ActivityAction.UPDATED, entityUuidFrom: 'params.completionUuid' })
    @Put(':completionUuid')
    @ApiOperation({ summary: 'Update completion values' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('completionUuid') completion_uuid: string,
        @Body() dto: UpdateFormCompletionDto,
    ) {
        return this.formCompletionsService.update(
            organisation_uuid,
            user_uuid,
            form_uuid,
            completion_uuid,
            dto,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.FORM_COMPLETION, action: ActivityAction.DELETED, entityUuidFrom: 'params.completionUuid' })
    @Delete(':completionUuid')
    @ApiOperation({ summary: 'Delete a form completion' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('completionUuid') completion_uuid: string,
    ) {
        return this.formCompletionsService.remove(
            organisation_uuid,
            user_uuid,
            form_uuid,
            completion_uuid,
        );
    }
}

@ApiTags('form-completions')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('form-completions')
export class FormCompletionsByContactController {
    constructor(private readonly formCompletionsService: FormCompletionsService) {}

    @Get('contact/:contactUuid')
    @ApiOperation({ summary: 'Get all form completions for a contact (across all forms)' })
    findByContact(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('contactUuid') contact_uuid: string,
    ) {
        return this.formCompletionsService.findByContact(organisation_uuid, contact_uuid);
    }
}

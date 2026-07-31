import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { FormFieldsService } from './form-fields.service';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';
import { ReorderFormFieldsDto } from './dto/reorder-form-fields.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('forms/:uuid/fields')
export class FormFieldsController {
    constructor(private readonly formFieldsService: FormFieldsService) {}

    @ActivityLog({ entityType: ActivityEntityType.FORM_FIELD, action: ActivityAction.CREATED })
    @Post()
    @ApiOperation({ summary: 'Add a field to a form' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: CreateFormFieldDto,
    ) {
        return this.formFieldsService.create(organisation_uuid, form_uuid, dto);
    }

    // IMPORTANT: /reorder must be declared before /:fieldUuid to prevent NestJS from matching "reorder" as a UUID param
    @ActivityLog({ entityType: ActivityEntityType.FORM_FIELD, action: ActivityAction.REORDERED, entityUuidFrom: 'none' })
    @Put('reorder')
    @ApiOperation({ summary: 'Reorder fields in a form' })
    reorder(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: ReorderFormFieldsDto,
    ) {
        return this.formFieldsService.reorder(organisation_uuid, form_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.FORM_FIELD, action: ActivityAction.UPDATED, entityUuidFrom: 'params.fieldUuid' })
    @Put(':fieldUuid')
    @ApiOperation({ summary: 'Update a form field' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('fieldUuid') field_uuid: string,
        @Body() dto: UpdateFormFieldDto,
    ) {
        return this.formFieldsService.update(organisation_uuid, form_uuid, field_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.FORM_FIELD, action: ActivityAction.DELETED, entityUuidFrom: 'params.fieldUuid' })
    @Delete(':fieldUuid')
    @ApiOperation({ summary: 'Delete a form field' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('fieldUuid') field_uuid: string,
    ) {
        return this.formFieldsService.remove(organisation_uuid, form_uuid, field_uuid);
    }
}

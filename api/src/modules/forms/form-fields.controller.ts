import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
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
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Form not found' })
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
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Form not found' })
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
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Field not found' })
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
    @UseGuards(OrganisationRolesGuard)
    @OrganisationRoles(OrganisationRole.ADMIN)
    @ApiOperation({ summary: 'Delete a form field' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden — organisation admin role required' })
    @ApiResponse({ status: 404, description: 'Field not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('fieldUuid') field_uuid: string,
    ) {
        return this.formFieldsService.remove(organisation_uuid, form_uuid, field_uuid);
    }
}

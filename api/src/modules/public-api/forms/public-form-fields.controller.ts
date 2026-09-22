import { Body, Controller, Delete, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { FormFieldsService } from '@/modules/forms/form-fields.service';
import { CreateFormFieldDto } from '@/modules/forms/dto/create-form-field.dto';
import { UpdateFormFieldDto } from '@/modules/forms/dto/update-form-field.dto';
import { ReorderFormFieldsDto } from '@/modules/forms/dto/reorder-form-fields.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@OrganisationRoles(OrganisationRole.ADMIN)
@Controller('public-api/v1/forms/:uuid/fields')
export class PublicFormFieldsController {
    constructor(private readonly formFieldsService: FormFieldsService) {}

    @Post()
    @ApiOperation({ summary: 'Add a field to a form' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: CreateFormFieldDto,
    ) {
        return this.formFieldsService.create(organisation_uuid, form_uuid, dto);
    }

    // IMPORTANT: /reorder must be declared before /:fieldUuid to prevent NestJS from matching "reorder" as a UUID param
    @Put('reorder')
    @ApiOperation({ summary: 'Reorder fields in a form' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    reorder(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: ReorderFormFieldsDto,
    ) {
        return this.formFieldsService.reorder(organisation_uuid, form_uuid, dto);
    }

    @Put(':fieldUuid')
    @ApiOperation({ summary: 'Update a form field' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Field not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('fieldUuid') field_uuid: string,
        @Body() dto: UpdateFormFieldDto,
    ) {
        return this.formFieldsService.update(organisation_uuid, form_uuid, field_uuid, dto);
    }

    @Delete(':fieldUuid')
    @ApiOperation({ summary: 'Delete a form field' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Field not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('fieldUuid') field_uuid: string,
    ) {
        return this.formFieldsService.remove(organisation_uuid, form_uuid, field_uuid);
    }
}

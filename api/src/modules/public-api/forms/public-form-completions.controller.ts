import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { FormCompletionsService } from '@/modules/forms/form-completions.service';
import { CreateFormCompletionDto } from '@/modules/forms/dto/create-form-completion.dto';
import { UpdateFormCompletionDto } from '@/modules/forms/dto/update-form-completion.dto';
import { ListFormCompletionsDto } from '@/modules/forms/dto/list-form-completions.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/forms/:uuid/completions')
export class PublicFormCompletionsController {
    constructor(private readonly formCompletionsService: FormCompletionsService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post()
    @ApiOperation({ summary: 'Create a form completion' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Param('uuid') form_uuid: string,
        @Body() dto: CreateFormCompletionDto,
    ) {
        return this.formCompletionsService.create(organisation_uuid, user_uuid, form_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List completions for a form' })
    @ApiResponse({ status: 200 })
    findAll(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Query() query: ListFormCompletionsDto,
    ) {
        return this.formCompletionsService.findAll(organisation_uuid, form_uuid, query);
    }

    @Get(':completionUuid')
    @ApiOperation({ summary: 'Get a single completion with all values' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Completion not found' })
    findOne(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') form_uuid: string,
        @Param('completionUuid') completion_uuid: string,
    ) {
        return this.formCompletionsService.findOne(organisation_uuid, form_uuid, completion_uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Put(':completionUuid')
    @ApiOperation({ summary: 'Update completion values' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Completion not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
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

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':completionUuid')
    @ApiOperation({ summary: 'Delete a form completion' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Completion not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
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

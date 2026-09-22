import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { FormsService } from '@/modules/forms/forms.service';
import { CreateFormDto } from '@/modules/forms/dto/create-form.dto';
import { UpdateFormDto } from '@/modules/forms/dto/update-form.dto';
import { ListFormsDto } from '@/modules/forms/dto/list-forms.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/forms')
export class PublicFormsController {
    constructor(private readonly formsService: FormsService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post()
    @ApiOperation({ summary: 'Create a form' })
    @ApiResponse({ status: 201 })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Body() dto: CreateFormDto,
    ) {
        return this.formsService.create(organisation_uuid, user_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List forms' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListFormsDto) {
        return this.formsService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a form with its fields' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.formsService.findOne(organisation_uuid, uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a form' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateFormDto,
    ) {
        return this.formsService.update(organisation_uuid, user_uuid, uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a form' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Form not found' })
    remove(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('acting_user_uuid') user_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.formsService.remove(organisation_uuid, user_uuid, uuid);
    }
}

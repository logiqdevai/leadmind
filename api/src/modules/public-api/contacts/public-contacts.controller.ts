import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { CreateContactDto } from '@/modules/contacts/dto/create-contact.dto';
import { UpdateContactDto } from '@/modules/contacts/dto/update-contact.dto';
import { ListContactsDto } from '@/modules/contacts/dto/list-contacts.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/contacts')
export class PublicContactsController {
    constructor(private readonly contactsService: ContactsService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post()
    @ApiOperation({ summary: 'Create a contact' })
    @ApiResponse({ status: 201 })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateContactDto) {
        return this.contactsService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List contacts' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListContactsDto) {
        return this.contactsService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a contact' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactsService.findOne(organisation_uuid, uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Put(':uuid')
    @ApiOperation({ summary: 'Update a contact' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateContactDto,
    ) {
        return this.contactsService.update(organisation_uuid, uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a contact' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactsService.remove(organisation_uuid, uuid);
    }
}

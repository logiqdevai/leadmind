import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { ApiKeyGuard } from '@/shared/guards/api-key.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ContactListsService } from '@/modules/contact-lists/contact-lists.service';
import { CreateContactListDto } from '@/modules/contact-lists/dto/create-contact-list.dto';
import { UpdateContactListDto } from '@/modules/contact-lists/dto/update-contact-list.dto';
import { ListContactListsDto } from '@/modules/contact-lists/dto/list-contact-lists.dto';
import { AddListContactsDto } from '@/modules/contact-lists/dto/add-list-contacts.dto';
import { ListContactListMembersDto } from '@/modules/contact-lists/dto/list-contact-list-members.dto';

@ApiTags('public-api')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard, OrganisationRolesGuard)
@Controller('public-api/v1/contact-lists')
export class PublicContactListsController {
    constructor(private readonly contactListsService: ContactListsService) {}

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post()
    @ApiOperation({ summary: 'Create a contact list' })
    @ApiResponse({ status: 201 })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateContactListDto) {
        return this.contactListsService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List contact lists' })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListContactListsDto) {
        return this.contactListsService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a contact list' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact list not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactListsService.findOne(organisation_uuid, uuid);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Patch(':uuid')
    @ApiOperation({ summary: 'Update a contact list' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact list not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateContactListDto,
    ) {
        return this.contactListsService.update(organisation_uuid, uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a contact list' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact list not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactListsService.remove(organisation_uuid, uuid);
    }

    @Get(':uuid/members')
    @ApiOperation({ summary: 'List contacts in a contact list' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact list not found' })
    findMembers(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ListContactListMembersDto,
    ) {
        return this.contactListsService.findMembers(organisation_uuid, uuid, query);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Post(':uuid/members')
    @ApiOperation({ summary: 'Add contacts to a list' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 404, description: 'Contact list not found' })
    addContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: AddListContactsDto,
    ) {
        return this.contactListsService.addContacts(organisation_uuid, uuid, dto);
    }

    @OrganisationRoles(OrganisationRole.ADMIN)
    @Delete(':uuid/members/:contactUuid')
    @ApiOperation({ summary: 'Remove a contact from a list' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Contact list not found, or contact is not in this list' })
    removeMember(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Param('contactUuid') contactUuid: string,
    ) {
        return this.contactListsService.removeContact(organisation_uuid, uuid, contactUuid);
    }
}

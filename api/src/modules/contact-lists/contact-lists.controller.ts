import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ContactListsService } from './contact-lists.service';
import { CreateContactListDto } from './dto/create-contact-list.dto';
import { UpdateContactListDto } from './dto/update-contact-list.dto';
import { ListContactListsDto } from './dto/list-contact-lists.dto';
import { AddListContactsDto } from './dto/add-list-contacts.dto';
import { BulkAddListContactsDto } from './dto/bulk-add-list-contacts.dto';
import { BulkRemoveListContactsDto } from './dto/bulk-remove-list-contacts.dto';
import {
    FilterListContactsByScoreDto,
    MoveListContactsBelowScoreDto,
} from './dto/filter-list-contacts-by-score.dto';
import { ListContactListMembersDto } from './dto/list-contact-list-members.dto';
import { UpdateListMemberStatusDto } from './dto/update-list-member-status.dto';
import { ContactAudienceStatsService } from '@/modules/contact-audience-stats/contact-audience-stats.service';
import { ContactAudienceAnalysisService } from '@/modules/contact-audience-stats/contact-audience-analysis.service';
import { ContactAudienceStatsQueryDto } from '@/modules/contact-audience-stats/dto/contact-audience-stats-query.dto';
import { ListContactAudienceAnalysesDto } from '@/modules/contact-audience-stats/dto/list-contact-audience-analyses.dto';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';

@ApiTags('contact-lists')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('contact-lists')
export class ContactListsController {
    constructor(
        private readonly contactListsService: ContactListsService,
        private readonly contactAudienceStatsService: ContactAudienceStatsService,
        private readonly contactAudienceAnalysisService: ContactAudienceAnalysisService,
    ) {}

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiOperation({ summary: 'Create a contact list' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateContactListDto) {
        return this.contactListsService.create(organisation_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List contact lists' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string, @Query() query: ListContactListsDto) {
        return this.contactListsService.findAll(organisation_uuid, query);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a contact list' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactListsService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiOperation({ summary: 'Update a contact list' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateContactListDto,
    ) {
        return this.contactListsService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete a contact list' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.contactListsService.remove(organisation_uuid, uuid);
    }

    @Get(':uuid/contacts')
    @ApiOperation({ summary: 'List contacts in a contact list' })
    findMembers(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ListContactListMembersDto,
    ) {
        return this.contactListsService.findMembers(organisation_uuid, uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_ADDED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts')
    @ApiOperation({ summary: 'Add contacts to a list' })
    addContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: AddListContactsDto,
    ) {
        return this.contactListsService.addContacts(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_BULK_ADDED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/bulk')
    @ApiOperation({ summary: 'Add all contacts matching filters to a list' })
    bulkAddContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: BulkAddListContactsDto,
    ) {
        return this.contactListsService.bulkAddContacts(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_REMOVED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/remove-below-score')
    @ApiOperation({ summary: 'Remove contacts from a list whose current score is below the given threshold' })
    removeContactsBelowScore(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: FilterListContactsByScoreDto,
    ) {
        return this.contactListsService.removeContactsBelowScore(
            organisation_uuid,
            uuid,
            dto.min_score ?? 6,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_REMOVED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/move-below-score')
    @ApiOperation({ summary: 'Move contacts whose current score is below the given threshold to another list' })
    moveContactsBelowScore(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: MoveListContactsBelowScoreDto,
    ) {
        return this.contactListsService.moveContactsBelowScore(
            organisation_uuid,
            uuid,
            dto.target_list_uuid,
            dto.min_score ?? 6,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_ADDED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/add-below-score')
    @ApiOperation({ summary: 'Add all contacts (regardless of list) whose current score is below the given threshold to this list' })
    addContactsBelowScore(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: FilterListContactsByScoreDto,
    ) {
        return this.contactListsService.addContactsBelowScoreToList(
            organisation_uuid,
            uuid,
            dto.min_score ?? 6,
        );
    }

    @Get(':uuid/contacts/duplicates')
    @ApiOperation({ summary: 'Preview contacts in this list that also belong to another list' })
    findDuplicateContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.contactListsService.findDuplicateListContacts(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_REMOVED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/remove-duplicates')
    @ApiOperation({ summary: 'Remove contacts from this list that also belong to another list' })
    removeDuplicateContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.contactListsService.removeDuplicateListContacts(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_REMOVED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/contacts/bulk-remove')
    @ApiOperation({ summary: 'Remove multiple contacts from a list' })
    removeContacts(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: BulkRemoveListContactsDto,
    ) {
        return this.contactListsService.removeContacts(organisation_uuid, uuid, dto.contact_uuids);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.CONTACTS_REMOVED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid/contacts/:contactUuid')
    @ApiOperation({ summary: 'Remove a contact from a list' })
    removeContact(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Param('contactUuid') contactUuid: string,
    ) {
        return this.contactListsService.removeContact(organisation_uuid, uuid, contactUuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.CONTACT_LIST, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid/contacts/:contactUuid/status')
    @ApiOperation({ summary: "Update a contact's status scoped to this list" })
    updateMemberStatus(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Param('contactUuid') contactUuid: string,
        @Body() dto: UpdateListMemberStatusDto,
    ) {
        return this.contactListsService.updateMemberStatus(
            organisation_uuid,
            uuid,
            contactUuid,
            dto.status,
        );
    }

    @Get(':uuid/stats')
    @ApiOperation({ summary: 'CRM and activity analytics for contacts in a list' })
    getStats(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ContactAudienceStatsQueryDto,
    ) {
        return this.contactAudienceStatsService.getListStats(organisation_uuid, uuid, query);
    }

    @Get(':uuid/analyses')
    @ApiOperation({ summary: 'List AI audience analyses for a contact list' })
    listAnalyses(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Query() query: ListContactAudienceAnalysesDto,
    ) {
        return this.contactAudienceAnalysisService.listListAnalyses(organisation_uuid, uuid, query);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_CREATED })
    @Post(':uuid/analyses')
    @ApiOperation({ summary: 'Run a new AI audience analysis for a contact list (full history stats)' })
    createAnalysis(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.contactAudienceAnalysisService.createListAnalysis(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.AUDIENCE_ANALYSIS, action: ActivityAction.ANALYSIS_DELETED, entityUuidFrom: 'params.analysisUuid' })
    @Delete(':uuid/analyses/:analysisUuid')
    @ApiOperation({ summary: 'Delete an AI audience analysis for a contact list' })
    deleteAnalysis(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Param('analysisUuid') analysisUuid: string,
    ) {
        return this.contactAudienceAnalysisService.deleteListAnalysis(organisation_uuid, uuid, analysisUuid);
    }
}

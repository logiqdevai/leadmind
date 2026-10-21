import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import { ActivityAction, ActivityEntityType } from '@/modules/activity-logs/constants/activity-log.constants';
import { OrgTagsService } from './org-tags.service';
import { CreateOrgTagDto } from './dto/create-org-tag.dto';
import { UpdateOrgTagDto } from './dto/update-org-tag.dto';
import { BulkUpdateOrgTagsDto } from './dto/bulk-update-org-tags.dto';

@ApiTags('org-tags')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('org-tags')
export class OrgTagsController {
    constructor(private readonly orgTagsService: OrgTagsService) {}

    @Get()
    @ApiOperation({
        summary:
            'List organisation tags (used to group contact lists, sequences, campaigns and filters) with usage counts per entity type',
    })
    @ApiResponse({ status: 200 })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.orgTagsService.findAll(organisation_uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORG_TAG, action: ActivityAction.CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiOperation({ summary: 'Create an organisation tag' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 409, description: 'A tag with this name already exists' })
    create(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: CreateOrgTagDto) {
        return this.orgTagsService.create(organisation_uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORG_TAG, action: ActivityAction.TAGS_UPDATED })
    @Post('bulk')
    @ApiOperation({
        summary: 'Add and/or remove tags on many contact lists, sequences, campaigns or filters at once',
    })
    @ApiResponse({ status: 201 })
    bulkUpdate(@CurrentUser('organisation_uuid') organisation_uuid: string, @Body() dto: BulkUpdateOrgTagsDto) {
        return this.orgTagsService.bulkUpdate(
            organisation_uuid,
            dto.entity_type,
            dto.entity_uuids,
            dto.add_tag_uuids,
            dto.remove_tag_uuids,
        );
    }

    @ActivityLog({ entityType: ActivityEntityType.ORG_TAG, action: ActivityAction.UPDATED, entityUuidFrom: 'params.uuid' })
    @Patch(':uuid')
    @ApiOperation({ summary: 'Rename or recolour an organisation tag' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateOrgTagDto,
    ) {
        return this.orgTagsService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.ORG_TAG, action: ActivityAction.DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Delete an organisation tag (removes it from every item)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.orgTagsService.remove(organisation_uuid, uuid);
    }
}

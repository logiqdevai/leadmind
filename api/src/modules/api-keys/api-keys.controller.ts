import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
    ActivityAction,
    ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtGuard, OrganisationRolesGuard)
@OrganisationRoles(OrganisationRole.OWNER, OrganisationRole.ADMIN)
@Controller('api-keys')
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @ActivityLog({ entityType: ActivityEntityType.API_KEY, action: ActivityAction.KEY_CREATED, includeBodyKeys: ['name'] })
    @Post()
    @ApiOperation({ summary: 'Generate a new API key for the current organisation. The raw token is only returned here.' })
    @ApiResponse({ status: 201 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    create(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @CurrentUser('uuid') user_uuid: string,
        @Body() dto: CreateApiKeyDto,
    ) {
        return this.apiKeysService.create(organisation_uuid, user_uuid, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List API keys for the current organisation (metadata only, no raw tokens)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.apiKeysService.findAll(organisation_uuid);
    }

    @Get(':uuid')
    @ApiOperation({ summary: 'Get a single API key (metadata only)' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'API key not found' })
    findOne(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.apiKeysService.findOne(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.API_KEY, action: ActivityAction.KEY_UPDATED, entityUuidFrom: 'params.uuid' })
    @Put(':uuid')
    @ApiOperation({ summary: 'Rename an API key, change its role, or update its expiry' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'API key not found' })
    update(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateApiKeyDto,
    ) {
        return this.apiKeysService.update(organisation_uuid, uuid, dto);
    }

    @ActivityLog({ entityType: ActivityEntityType.API_KEY, action: ActivityAction.KEY_REVOKED, entityUuidFrom: 'params.uuid' })
    @Post(':uuid/revoke')
    @ApiOperation({ summary: 'Revoke an API key so it can no longer authenticate' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'API key not found' })
    revoke(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.apiKeysService.revoke(organisation_uuid, uuid);
    }

    @ActivityLog({ entityType: ActivityEntityType.API_KEY, action: ActivityAction.KEY_DELETED, entityUuidFrom: 'params.uuid' })
    @Delete(':uuid')
    @ApiOperation({ summary: 'Permanently delete an API key' })
    @ApiResponse({ status: 200 })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'API key not found' })
    remove(@CurrentUser('organisation_uuid') organisation_uuid: string, @Param('uuid') uuid: string) {
        return this.apiKeysService.remove(organisation_uuid, uuid);
    }
}

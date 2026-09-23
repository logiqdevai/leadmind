import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganisationRole } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { OrganisationRoles } from '@/shared/decorators/organisation-roles.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrganisationRolesGuard } from '@/shared/guards/organisation-roles.guard';
import { OAuthConnectionsService } from '../services/oauth-connections.service';

@ApiTags('oauth-connections')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('oauth/connections')
export class OAuthConnectionsController {
  constructor(private readonly connections: OAuthConnectionsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List third-party apps (Claude, ChatGPT, ...) connected to this organisation via OAuth',
  })
  @ApiResponse({ status: 200 })
  findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
    return this.connections.findAll(organisation_uuid);
  }

  @Delete(':uuid')
  @UseGuards(OrganisationRolesGuard)
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({
    summary:
      'Revoke a connected app - destroys all of its access/refresh tokens immediately',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Connected app not found' })
  revoke(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.connections.revoke(organisation_uuid, uuid);
  }
}

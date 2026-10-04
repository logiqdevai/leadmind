import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CreateAccessTokenDto } from '../dto/create-access-token.dto';
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

  @Post('access-tokens')
  @UseGuards(OrganisationRolesGuard)
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({
    summary:
      'Create a personal access token for the current user in this organisation. The token is returned once and cannot be retrieved again.',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Caller is not an owner or admin' })
  createAccessToken(
    @CurrentUser('uuid') user_uuid: string,
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Body() dto: CreateAccessTokenDto,
  ) {
    return this.connections.createAccessToken(
      user_uuid,
      organisation_uuid,
      dto,
    );
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

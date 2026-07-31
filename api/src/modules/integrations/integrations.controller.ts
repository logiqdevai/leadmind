import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseEnumPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { ExternalIntegrationProvider } from '@/generated/prisma';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationKeyDto } from './dto/create-integration-key.dto';
import { CreateSmtpAccountDto } from './dto/create-smtp-account.dto';
import { SetDefaultIntegrationAccountDto } from './dto/set-default-integration-account.dto';
import { UpdateIntegrationAccountDto } from './dto/update-integration-account.dto';
import { UpdateIntegrationKeyDto } from './dto/update-integration-key.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('integrations')
export class IntegrationsController {
    constructor(private readonly integrationsService: IntegrationsService) {}

    @Get()
    @ApiOperation({ summary: 'List integration providers and stored keys' })
    findAll(@CurrentUser('organisation_uuid') organisation_uuid: string) {
        return this.integrationsService.findAll(organisation_uuid);
    }

    @Post(':provider/keys')
    @ApiOperation({ summary: 'Store a key for an integration provider' })
    createKey(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('provider', new ParseEnumPipe(ExternalIntegrationProvider))
        provider: ExternalIntegrationProvider,
        @Body() dto: CreateIntegrationKeyDto,
    ) {
        return this.integrationsService.createKey(organisation_uuid, provider, dto);
    }

    @Post('SMTP/accounts')
    @ApiOperation({ summary: 'Create a complete SMTP account in one request' })
    createSmtpAccount(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Body() dto: CreateSmtpAccountDto,
    ) {
        return this.integrationsService.createSmtpAccount(organisation_uuid, dto);
    }

    @Patch('keys/:uuid')
    @ApiOperation({ summary: 'Update a stored key secret' })
    @ApiResponse({ status: 404, description: 'Key not found' })
    updateKey(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
        @Body() dto: UpdateIntegrationKeyDto,
    ) {
        return this.integrationsService.updateKey(organisation_uuid, uuid, dto);
    }

    @Patch(':provider/default-account')
    @ApiOperation({ summary: 'Set the default account for a multi-account integration' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    setDefaultAccount(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('provider', new ParseEnumPipe(ExternalIntegrationProvider))
        provider: ExternalIntegrationProvider,
        @Body() dto: SetDefaultIntegrationAccountDto,
    ) {
        return this.integrationsService.setDefaultAccount(organisation_uuid, provider, dto);
    }

    @Patch(':provider/accounts/:account')
    @ApiOperation({ summary: 'Update the display title for an integration account' })
    @ApiResponse({ status: 404, description: 'Integration not found' })
    updateAccountTitle(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('provider', new ParseEnumPipe(ExternalIntegrationProvider))
        provider: ExternalIntegrationProvider,
        @Param('account') account: string,
        @Body() dto: UpdateIntegrationAccountDto,
    ) {
        return this.integrationsService.updateAccountTitle(
            organisation_uuid,
            provider,
            account,
            dto,
        );
    }

    @Delete('keys/:uuid')
    @ApiOperation({ summary: 'Delete a stored key' })
    @ApiResponse({ status: 404, description: 'Key not found' })
    removeKey(
        @CurrentUser('organisation_uuid') organisation_uuid: string,
        @Param('uuid') uuid: string,
    ) {
        return this.integrationsService.removeKey(organisation_uuid, uuid);
    }
}


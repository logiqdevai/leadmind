import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { ActivityLog } from '@/modules/activity-logs/decorators/activity-log.decorator';
import {
  ActivityAction,
  ActivityEntityType,
} from '@/modules/activity-logs/constants/activity-log.constants';
import { MxToolboxService } from './mxtoolbox.service';
import { CreateMxToolboxCheckDto } from './dto/create-mxtoolbox-check.dto';

@ApiTags('mxtoolbox')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('mxtoolbox')
export class MxToolboxController {
  constructor(private readonly mxToolboxService: MxToolboxService) {}

  @Get('checks')
  @ApiOperation({ summary: 'List recent MxToolbox domain health checks' })
  listChecks(@CurrentUser('organisation_uuid') organisation_uuid: string) {
    return this.mxToolboxService.listChecks(organisation_uuid);
  }

  @ActivityLog({
    entityType: ActivityEntityType.INTEGRATION,
    action: ActivityAction.MXTOOLBOX_CHECK_STARTED,
    entityUuidFrom: 'result.uuid',
  })
  @Post('checks')
  @ApiOperation({ summary: 'Run a domain health check against MxToolbox' })
  startCheck(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Body() dto: CreateMxToolboxCheckDto,
  ) {
    return this.mxToolboxService.startCheck(organisation_uuid, dto);
  }

  @Post('checks/:uuid/rerun')
  @ApiOperation({ summary: 'Re-run a stored domain health check' })
  @ApiResponse({ status: 404, description: 'Check not found' })
  rerunCheck(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.mxToolboxService.rerunCheck(organisation_uuid, uuid);
  }

  @Post('checks/:uuid/ai-audit')
  @ApiOperation({
    summary:
      'Run an AI audit of a MxToolbox check result (overwrites the previous audit)',
  })
  @ApiResponse({ status: 404, description: 'Check not found' })
  runAiAudit(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.mxToolboxService.runAiAudit(organisation_uuid, uuid);
  }
}

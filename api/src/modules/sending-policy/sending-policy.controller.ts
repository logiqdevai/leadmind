import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { SendingPolicyService } from './services/sending-policy.service';
import { CreateSendingPolicyDto } from './dto/create-sending-policy.dto';
import { UpdateSendingPolicyDto } from './dto/update-sending-policy.dto';
import { UpsertSendingPolicyStageDto } from './dto/upsert-sending-policy-stage.dto';
import { ReorderSendingPolicyStagesDto } from './dto/reorder-sending-policy-stages.dto';
import { PreviewSendingPolicyDto } from './dto/preview-sending-policy.dto';

@ApiTags('sending-policies')
@ApiBearerAuth()
@UseGuards(JwtGuard, OrganisationRolesGuard)
@Controller('sending-policies')
export class SendingPolicyController {
  constructor(private readonly sendingPolicyService: SendingPolicyService) {}

  @Get()
  @ApiOperation({
    summary: "List the organisation's reusable sending policy templates",
  })
  list(@CurrentUser('organisation_uuid') organisation_uuid: string) {
    return this.sendingPolicyService.list(organisation_uuid);
  }

  @Get(':uuid')
  @ApiOperation({
    summary: 'Get a sending policy (template or campaign-assigned clone)',
  })
  findOne(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.sendingPolicyService.findOne(organisation_uuid, uuid);
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY,
    action: ActivityAction.CREATED,
    entityUuidFrom: 'result.uuid',
  })
  @Post()
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Create a reusable sending policy template' })
  create(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Body() dto: CreateSendingPolicyDto,
  ) {
    return this.sendingPolicyService.create(organisation_uuid, dto);
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY,
    action: ActivityAction.UPDATED,
    entityUuidFrom: 'params.uuid',
  })
  @Patch(':uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Update a sending policy template' })
  update(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateSendingPolicyDto,
  ) {
    return this.sendingPolicyService.update(organisation_uuid, uuid, dto);
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY,
    action: ActivityAction.DELETED,
    entityUuidFrom: 'params.uuid',
  })
  @Delete(':uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({
    summary:
      'Delete a sending policy template (does not affect existing clones)',
  })
  remove(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
  ) {
    return this.sendingPolicyService.remove(organisation_uuid, uuid);
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY_STAGE,
    action: ActivityAction.CREATED,
    entityUuidFrom: 'params.uuid',
  })
  @Post(':uuid/stages')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Add a stage to a sending policy template' })
  addStage(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Body() dto: UpsertSendingPolicyStageDto,
  ) {
    return this.sendingPolicyService.addStage(organisation_uuid, uuid, dto);
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY_STAGE,
    action: ActivityAction.UPDATED,
    entityUuidFrom: 'params.stage_uuid',
  })
  @Patch(':uuid/stages/:stage_uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Edit a sending policy stage' })
  updateStage(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Param('stage_uuid') stage_uuid: string,
    @Body() dto: UpsertSendingPolicyStageDto,
  ) {
    return this.sendingPolicyService.updateStage(
      organisation_uuid,
      uuid,
      stage_uuid,
      dto,
    );
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY_STAGE,
    action: ActivityAction.DELETED,
    entityUuidFrom: 'params.stage_uuid',
  })
  @Delete(':uuid/stages/:stage_uuid')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: 'Delete a sending policy stage' })
  removeStage(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Param('stage_uuid') stage_uuid: string,
  ) {
    return this.sendingPolicyService.removeStage(
      organisation_uuid,
      uuid,
      stage_uuid,
    );
  }

  @ActivityLog({
    entityType: ActivityEntityType.SENDING_POLICY_STAGE,
    action: ActivityAction.REORDERED,
    entityUuidFrom: 'params.uuid',
  })
  @Put(':uuid/stages/reorder')
  @OrganisationRoles(OrganisationRole.ADMIN)
  @ApiOperation({ summary: "Reorder a sending policy's stages" })
  reorderStages(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Body() dto: ReorderSendingPolicyStagesDto,
  ) {
    return this.sendingPolicyService.reorderStages(
      organisation_uuid,
      uuid,
      dto.stage_uuids,
    );
  }

  @Post(':uuid/preview')
  @ApiOperation({
    summary:
      'Preview the estimated send schedule for a policy against a contact count',
  })
  preview(
    @CurrentUser('organisation_uuid') organisation_uuid: string,
    @Param('uuid') uuid: string,
    @Body() dto: PreviewSendingPolicyDto,
  ) {
    return this.sendingPolicyService.preview(organisation_uuid, uuid, dto);
  }
}

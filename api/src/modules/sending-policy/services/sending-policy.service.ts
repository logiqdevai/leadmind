import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SendingPolicy } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { CreateSendingPolicyDto } from '../dto/create-sending-policy.dto';
import { UpdateSendingPolicyDto } from '../dto/update-sending-policy.dto';
import { UpsertSendingPolicyStageDto } from '../dto/upsert-sending-policy-stage.dto';
import { PreviewSendingPolicyDto } from '../dto/preview-sending-policy.dto';
import { SendingStageResolverService } from './sending-stage-resolver.service';
import { SchedulePreviewResult } from '../interfaces/sending-policy.interface';

const POLICY_INCLUDE = {
  stages: { orderBy: { order_index: 'asc' as const } },
};

@Injectable()
export class SendingPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageResolver: SendingStageResolverService,
  ) {}

  async create(organisation_uuid: string, dto: CreateSendingPolicyDto) {
    return this.prisma.sendingPolicy.create({
      data: {
        organisation_uuid,
        name: dto.name,
        description: dto.description,
        is_template: true,
        timezone: dto.timezone ?? 'UTC',
        window_start_minute: dto.window_start_minute,
        window_end_minute: dto.window_end_minute,
        min_interval_seconds: dto.min_interval_seconds ?? 0,
        min_interval_jitter_seconds: dto.min_interval_jitter_seconds ?? 0,
        stages: {
          create: dto.stages.map((stage, index) =>
            this.toStageCreateData(stage, index),
          ),
        },
      },
      include: POLICY_INCLUDE,
    });
  }

  async list(organisation_uuid: string) {
    return this.prisma.sendingPolicy.findMany({
      where: { organisation_uuid, is_template: true },
      include: POLICY_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(organisation_uuid: string, uuid: string) {
    const policy = await this.prisma.sendingPolicy.findFirst({
      where: { uuid, organisation_uuid },
      include: POLICY_INCLUDE,
    });
    if (!policy)
      throw new NotFoundException(`Sending policy ${uuid} not found`);
    return policy;
  }

  async update(
    organisation_uuid: string,
    uuid: string,
    dto: UpdateSendingPolicyDto,
  ) {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    return this.prisma.sendingPolicy.update({
      where: { uuid: policy.uuid },
      data: {
        name: dto.name,
        description: dto.description,
        timezone: dto.timezone,
        window_start_minute: dto.window_start_minute,
        window_end_minute: dto.window_end_minute,
        min_interval_seconds: dto.min_interval_seconds,
        min_interval_jitter_seconds: dto.min_interval_jitter_seconds,
      },
      include: POLICY_INCLUDE,
    });
  }

  async remove(
    organisation_uuid: string,
    uuid: string,
  ): Promise<{ deleted: true }> {
    const policy = await this.requireTemplate(organisation_uuid, uuid);
    // Cloned instances keep source_policy_uuid via onDelete: SetNull - deleting a
    // template never touches campaigns already using a clone of it.
    await this.prisma.sendingPolicy.delete({ where: { uuid: policy.uuid } });
    return { deleted: true };
  }

  async addStage(
    organisation_uuid: string,
    uuid: string,
    dto: UpsertSendingPolicyStageDto,
  ) {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    const maxOrder = await this.prisma.sendingPolicyStage.aggregate({
      where: { sending_policy_uuid: policy.uuid },
      _max: { order_index: true },
    });
    const nextIndex = (maxOrder._max.order_index ?? -1) + 1;
    await this.prisma.sendingPolicyStage.create({
      data: {
        sending_policy_uuid: policy.uuid,
        ...this.toStageCreateData(dto, nextIndex),
      },
    });
    return this.findOne(organisation_uuid, uuid);
  }

  async updateStage(
    organisation_uuid: string,
    uuid: string,
    stage_uuid: string,
    dto: UpsertSendingPolicyStageDto,
  ) {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    const stage = await this.prisma.sendingPolicyStage.findFirst({
      where: { uuid: stage_uuid, sending_policy_uuid: policy.uuid },
    });
    if (!stage) throw new NotFoundException(`Stage ${stage_uuid} not found`);
    await this.prisma.sendingPolicyStage.update({
      where: { uuid: stage_uuid },
      data: {
        limit: dto.limit,
        period_unit: dto.period_unit,
        duration_value: dto.duration_value ?? null,
        duration_unit: dto.duration_unit ?? null,
      },
    });
    return this.findOne(organisation_uuid, uuid);
  }

  async removeStage(
    organisation_uuid: string,
    uuid: string,
    stage_uuid: string,
  ) {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    const stage = await this.prisma.sendingPolicyStage.findFirst({
      where: { uuid: stage_uuid, sending_policy_uuid: policy.uuid },
    });
    if (!stage) throw new NotFoundException(`Stage ${stage_uuid} not found`);
    const stageCount = await this.prisma.sendingPolicyStage.count({
      where: { sending_policy_uuid: policy.uuid },
    });
    if (stageCount <= 1) {
      throw new BadRequestException(
        'A sending policy must have at least one stage',
      );
    }
    await this.prisma.sendingPolicyStage.delete({
      where: { uuid: stage_uuid },
    });
    return this.findOne(organisation_uuid, uuid);
  }

  async reorderStages(
    organisation_uuid: string,
    uuid: string,
    stage_uuids: string[],
  ) {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    const existing = await this.prisma.sendingPolicyStage.findMany({
      where: { sending_policy_uuid: policy.uuid },
      select: { uuid: true },
    });
    const existingUuids = new Set(existing.map((s) => s.uuid));
    if (
      stage_uuids.length !== existingUuids.size ||
      !stage_uuids.every((id) => existingUuids.has(id))
    ) {
      throw new BadRequestException(
        "stage_uuids must match the policy's current stages exactly",
      );
    }

    await this.prisma.$transaction(
      stage_uuids.map((stage_uuid, index) =>
        this.prisma.sendingPolicyStage.update({
          where: { uuid: stage_uuid },
          data: { order_index: index },
        }),
      ),
    );
    return this.findOne(organisation_uuid, uuid);
  }

  async preview(
    organisation_uuid: string,
    uuid: string,
    dto: PreviewSendingPolicyDto,
  ): Promise<SchedulePreviewResult> {
    const policy = await this.findOne(organisation_uuid, uuid);
    const startAt = dto.start_at ? new Date(dto.start_at) : new Date();
    return this.stageResolver.previewSchedule(
      policy.stages,
      dto.contact_count,
      startAt,
    );
  }

  /**
   * Clones a template (or any policy) into an immutable, non-template instance for
   * assignment to a CampaignIntegration. Editing/deleting the source afterwards never
   * affects the clone.
   */
  async cloneForAssignment(
    organisation_uuid: string,
    source_policy_uuid: string,
  ): Promise<SendingPolicy> {
    const source = await this.prisma.sendingPolicy.findFirst({
      where: { uuid: source_policy_uuid, organisation_uuid },
      include: POLICY_INCLUDE,
    });
    if (!source) {
      throw new NotFoundException(
        `Sending policy ${source_policy_uuid} not found`,
      );
    }

    return this.prisma.sendingPolicy.create({
      data: {
        organisation_uuid,
        name: source.name,
        description: source.description,
        is_template: false,
        source_policy_uuid: source.uuid,
        timezone: source.timezone,
        window_start_minute: source.window_start_minute,
        window_end_minute: source.window_end_minute,
        min_interval_seconds: source.min_interval_seconds,
        min_interval_jitter_seconds: source.min_interval_jitter_seconds,
        stages: {
          create: source.stages.map((stage) => ({
            order_index: stage.order_index,
            limit: stage.limit,
            period_unit: stage.period_unit,
            duration_value: stage.duration_value,
            duration_unit: stage.duration_unit,
          })),
        },
      },
    });
  }

  private toStageCreateData(
    dto: UpsertSendingPolicyStageDto,
    order_index: number,
  ) {
    const hasDuration =
      dto.duration_value !== undefined && dto.duration_unit !== undefined;
    if (
      (dto.duration_value !== undefined || dto.duration_unit !== undefined) &&
      !hasDuration
    ) {
      throw new BadRequestException(
        'duration_value and duration_unit must be provided together, or both omitted for the final stage',
      );
    }
    return {
      order_index,
      limit: dto.limit,
      period_unit: dto.period_unit,
      duration_value: dto.duration_value ?? null,
      duration_unit: dto.duration_unit ?? null,
    };
  }

  /**
   * Edits (name/window/interval/stages) are allowed on any org-owned policy - template
   * or campaign-assigned clone. A clone belongs 1:1 to a single CampaignIntegration, so
   * editing it only changes that one campaign's schedule; it never retroactively
   * changes a shared template or other campaigns' clones.
   */
  private async requireOwnedPolicy(
    organisation_uuid: string,
    uuid: string,
  ): Promise<SendingPolicy> {
    const policy = await this.prisma.sendingPolicy.findFirst({
      where: { uuid, organisation_uuid },
    });
    if (!policy)
      throw new NotFoundException(`Sending policy ${uuid} not found`);
    return policy;
  }

  /** Deleting a whole policy row stays template-only - a clone is protected by its
   * CampaignIntegration's onDelete: Restrict foreign key regardless. */
  private async requireTemplate(
    organisation_uuid: string,
    uuid: string,
  ): Promise<SendingPolicy> {
    const policy = await this.requireOwnedPolicy(organisation_uuid, uuid);
    if (!policy.is_template) {
      throw new ConflictException(
        'This sending policy is a campaign-assigned clone and cannot be deleted directly',
      );
    }
    return policy;
  }
}

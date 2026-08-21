import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignIntegrationStatus } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { SendingPolicyService } from '@/modules/sending-policy/services/sending-policy.service';
import { SendingCapacityService } from '@/modules/sending-capacity/services/sending-capacity.service';
import { AssignCampaignIntegrationDto } from '../dto/assign-campaign-integration.dto';
import { UpdateCampaignIntegrationStatusDto } from '../dto/update-campaign-integration-status.dto';

const CAMPAIGN_INTEGRATION_INCLUDE = {
  integration_account: { include: { integration: true } },
  sending_policy: {
    include: { stages: { orderBy: { order_index: 'asc' as const } } },
  },
  state: true,
};

@Injectable()
export class CampaignIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendingPolicyService: SendingPolicyService,
    private readonly sendingCapacityService: SendingCapacityService,
  ) {}

  async list(
    organisation_uuid: string,
    campaign_uuid: string,
    includeRemoved = false,
  ) {
    await this.requireCampaign(organisation_uuid, campaign_uuid);
    return this.prisma.campaignIntegration.findMany({
      where: {
        campaign_uuid,
        ...(includeRemoved
          ? {}
          : { status: { not: CampaignIntegrationStatus.REMOVED } }),
      },
      include: CAMPAIGN_INTEGRATION_INCLUDE,
      orderBy: { created_at: 'asc' },
    });
  }

  async assign(
    organisation_uuid: string,
    campaign_uuid: string,
    dto: AssignCampaignIntegrationDto,
  ) {
    await this.requireCampaign(organisation_uuid, campaign_uuid);

    const account = await this.prisma.integrationAccount.findFirst({
      where: {
        uuid: dto.integration_account_uuid,
        integration: { organisation_uuid },
      },
    });
    if (!account) {
      throw new NotFoundException(
        `Integration account ${dto.integration_account_uuid} not found`,
      );
    }

    const clonedPolicy = await this.sendingPolicyService.cloneForAssignment(
      organisation_uuid,
      dto.sending_policy_uuid,
    );

    const existing = await this.prisma.campaignIntegration.findUnique({
      where: {
        campaign_uuid_integration_account_uuid: {
          campaign_uuid,
          integration_account_uuid: dto.integration_account_uuid,
        },
      },
    });

    if (existing && existing.status !== CampaignIntegrationStatus.REMOVED) {
      throw new ConflictException(
        'This integration account is already assigned to this campaign',
      );
    }

    if (existing) {
      // Reactivating a previously-removed assignment: fresh policy clone, fresh runtime state.
      await this.prisma.campaignIntegration.update({
        where: { uuid: existing.uuid },
        data: {
          sending_policy_uuid: clonedPolicy.uuid,
          status: CampaignIntegrationStatus.ACTIVE,
        },
      });
      await this.prisma.campaignIntegrationState.deleteMany({
        where: { campaign_integration_uuid: existing.uuid },
      });
      await this.prisma.campaignIntegrationState.create({
        data: { campaign_integration_uuid: existing.uuid },
      });
      return this.findOne(organisation_uuid, campaign_uuid, existing.uuid);
    }

    const created = await this.prisma.campaignIntegration.create({
      data: {
        campaign_uuid,
        integration_account_uuid: dto.integration_account_uuid,
        sending_policy_uuid: clonedPolicy.uuid,
        status: CampaignIntegrationStatus.ACTIVE,
        state: { create: {} },
      },
    });
    return this.findOne(organisation_uuid, campaign_uuid, created.uuid);
  }

  async updateStatus(
    organisation_uuid: string,
    campaign_uuid: string,
    ci_uuid: string,
    dto: UpdateCampaignIntegrationStatusDto,
  ) {
    const ci = await this.requireOwned(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
    );
    if (ci.status === CampaignIntegrationStatus.REMOVED) {
      throw new BadRequestException(
        'Cannot change the status of a removed campaign integration',
      );
    }
    await this.prisma.campaignIntegration.update({
      where: { uuid: ci.uuid },
      data: { status: dto.status as CampaignIntegrationStatus },
    });
    return this.findOne(organisation_uuid, campaign_uuid, ci_uuid);
  }

  async remove(
    organisation_uuid: string,
    campaign_uuid: string,
    ci_uuid: string,
  ) {
    const ci = await this.requireOwned(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
    );
    await this.prisma.campaignIntegration.update({
      where: { uuid: ci.uuid },
      data: { status: CampaignIntegrationStatus.REMOVED },
    });
    return { removed: true };
  }

  async getCapacity(
    organisation_uuid: string,
    campaign_uuid: string,
    ci_uuid: string,
  ) {
    await this.requireOwned(organisation_uuid, campaign_uuid, ci_uuid);
    return this.sendingCapacityService.getObservability(ci_uuid);
  }

  private async findOne(
    organisation_uuid: string,
    campaign_uuid: string,
    ci_uuid: string,
  ) {
    return this.requireOwned(
      organisation_uuid,
      campaign_uuid,
      ci_uuid,
      CAMPAIGN_INTEGRATION_INCLUDE,
    );
  }

  private async requireCampaign(
    organisation_uuid: string,
    campaign_uuid: string,
  ) {
    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { uuid: campaign_uuid, organisation_uuid },
    });
    if (!campaign)
      throw new NotFoundException(`Campaign ${campaign_uuid} not found`);
    return campaign;
  }

  private async requireOwned(
    organisation_uuid: string,
    campaign_uuid: string,
    ci_uuid: string,
    include?: typeof CAMPAIGN_INTEGRATION_INCLUDE,
  ) {
    await this.requireCampaign(organisation_uuid, campaign_uuid);
    const ci = await this.prisma.campaignIntegration.findFirst({
      where: { uuid: ci_uuid, campaign_uuid },
      include,
    });
    if (!ci)
      throw new NotFoundException(`Campaign integration ${ci_uuid} not found`);
    return ci;
  }
}

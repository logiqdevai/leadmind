import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalIntegrationProvider,
  IntegrationKeyType,
} from '@/generated/prisma';
import { IntegrationsService } from '../integrations.service';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import {
  listDistinctIntegrationAccounts,
  requiredKeyTypesForProvider,
  resolveEffectiveDefaultAccount,
} from '../constants/integration-key-types.constants';
import { formatSmtpFromAddress } from '@/integrations/notifications/smtp/utils/format-smtp-from-address.util';
import {
  EmailProviderTarget,
  SendableEmailAccount,
  SmtpConfig,
} from '../interfaces/email-credentials.interface';

const EMAIL_PROVIDERS = [
  ExternalIntegrationProvider.RESEND,
  ExternalIntegrationProvider.SMTP,
] as const;

@Injectable()
export class EmailCredentialsService {
  private readonly logger = new Logger(EmailCredentialsService.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly prisma: PrismaService,
  ) {}

  async getResendFromEmail(
    organisation_uuid: string,
    account: string,
    domain_uuid?: string,
  ): Promise<string> {
    await this.assertSendableAccount(
      organisation_uuid,
      ExternalIntegrationProvider.RESEND,
      account,
    );

    const integrationAccount = await this.prisma.integrationAccount.findFirst(
      {
        where: {
          account: account.trim(),
          integration: {
            organisation_uuid,
            provider: ExternalIntegrationProvider.RESEND,
          },
        },
        include: { domains: true },
      },
    );

    if (integrationAccount && integrationAccount.domains.length > 0) {
      const domain = domain_uuid
        ? integrationAccount.domains.find((row) => row.uuid === domain_uuid)
        : (integrationAccount.domains.find((row) => row.is_default) ??
          integrationAccount.domains[0]);
      if (!domain) {
        throw new BadRequestException(
          `Domain ${domain_uuid} not found for Resend account "${account}"`,
        );
      }
      return domain.from_email.trim();
    }

    // Legacy fallback for accounts not yet migrated to IntegrationAccountDomain.
    const fromEmail = await this.integrationsService.getDecryptedSecret(
      organisation_uuid,
      ExternalIntegrationProvider.RESEND,
      IntegrationKeyType.FROM_EMAIL,
      account,
    );
    return fromEmail.trim();
  }

  async getResendApiKey(
    organisation_uuid: string,
    account: string,
  ): Promise<string> {
    this.logger.log(
      `Loading Resend API key user=${organisation_uuid} account=${account}`,
    );
    await this.assertSendableAccount(
      organisation_uuid,
      ExternalIntegrationProvider.RESEND,
      account,
    );
    const secret = await this.integrationsService.getDecryptedSecret(
      organisation_uuid,
      ExternalIntegrationProvider.RESEND,
      IntegrationKeyType.API_KEY,
      account,
    );
    this.logger.log(
      `Resend API key loaded user=${organisation_uuid} account=${account} last4=${secret.slice(-4)}`,
    );
    return secret;
  }

  async getResendWebhookSecret(
    organisation_uuid: string,
    account: string,
  ): Promise<string> {
    return this.integrationsService.getDecryptedSecret(
      organisation_uuid,
      ExternalIntegrationProvider.RESEND,
      IntegrationKeyType.WEBHOOK_SECRET,
      account,
    );
  }

  async tryGetResendWebhookSecret(
    organisation_uuid: string,
    account: string,
  ): Promise<string | null> {
    try {
      return await this.getResendWebhookSecret(organisation_uuid, account);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async listResendWebhookSecrets(organisation_uuid: string): Promise<string[]> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        organisation_uuid_provider: {
          organisation_uuid,
          provider: ExternalIntegrationProvider.RESEND,
        },
      },
      include: {
        keys: {
          where: { key_type: IntegrationKeyType.WEBHOOK_SECRET },
        },
      },
    });
    if (!integration?.keys.length) {
      return [];
    }

    const secrets = await Promise.all(
      integration.keys.map((key) =>
        this.tryGetResendWebhookSecret(organisation_uuid, key.account),
      ),
    );
    return secrets.filter((secret): secret is string => Boolean(secret));
  }

  async getSmtpConfig(
    organisation_uuid: string,
    account: string,
  ): Promise<SmtpConfig> {
    await this.assertSendableAccount(
      organisation_uuid,
      ExternalIntegrationProvider.SMTP,
      account,
    );
    const [host, port, username, password, fromEmail, fromName] =
      await Promise.all([
        this.integrationsService.getDecryptedSecret(
          organisation_uuid,
          ExternalIntegrationProvider.SMTP,
          IntegrationKeyType.HOST,
          account,
        ),
        this.integrationsService.getDecryptedSecret(
          organisation_uuid,
          ExternalIntegrationProvider.SMTP,
          IntegrationKeyType.PORT,
          account,
        ),
        this.integrationsService.getDecryptedSecret(
          organisation_uuid,
          ExternalIntegrationProvider.SMTP,
          IntegrationKeyType.USERNAME,
          account,
        ),
        this.integrationsService.getDecryptedSecret(
          organisation_uuid,
          ExternalIntegrationProvider.SMTP,
          IntegrationKeyType.PASSWORD,
          account,
        ),
        this.integrationsService.getDecryptedSecret(
          organisation_uuid,
          ExternalIntegrationProvider.SMTP,
          IntegrationKeyType.FROM_EMAIL,
          account,
        ),
        this.tryGetSmtpFromName(organisation_uuid, account),
      ]);

    const parsedPort = parseInt(port, 10);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      throw new BadRequestException(`Invalid SMTP port for account ${account}`);
    }

    return {
      host: host.trim(),
      port: parsedPort,
      username: username.trim(),
      password,
      fromEmail: fromEmail.trim(),
      fromName: fromName?.trim() || null,
    };
  }

  private async tryGetSmtpFromName(
    organisation_uuid: string,
    account: string,
  ): Promise<string | null> {
    try {
      return await this.integrationsService.getDecryptedSecret(
        organisation_uuid,
        ExternalIntegrationProvider.SMTP,
        IntegrationKeyType.FROM_NAME,
        account,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async assertSendableAccount(
    organisation_uuid: string,
    provider: EmailProviderTarget['provider'],
    account: string,
  ): Promise<void> {
    const sendable = await this.resolveSendableAccounts(organisation_uuid);
    const match = sendable.find(
      (row) => row.provider === provider && row.account === account.trim(),
    );
    if (!match) {
      throw new BadRequestException(
        `${provider} account "${account}" is not configured or incomplete`,
      );
    }
  }

  async resolveSendableAccounts(
    organisation_uuid: string,
  ): Promise<SendableEmailAccount[]> {
    const integrations = await this.prisma.integration.findMany({
      where: {
        organisation_uuid,
        provider: { in: [...EMAIL_PROVIDERS] },
      },
      include: { keys: true, accounts: { include: { domains: true } } },
    });

    const accounts: SendableEmailAccount[] = [];

    for (const integration of integrations) {
      const accountRowByAccount = new Map(
        integration.accounts.map((row) => [row.account, row]),
      );
      const distinctAccounts = listDistinctIntegrationAccounts(
        integration.keys,
      );
      for (const account of distinctAccounts) {
        if (
          this.isAccountComplete(
            integration.provider,
            integration.keys,
            account,
            accountRowByAccount.get(account)?.domains ?? [],
          )
        ) {
          const row = accountRowByAccount.get(account);
          const title = row?.title ?? account;
          accounts.push({
            provider: integration.provider as EmailProviderTarget['provider'],
            account,
            label: `${integration.provider} · ${title}`,
            domains: row?.domains.map((domain) => ({
              uuid: domain.uuid,
              from_email: domain.from_email,
              from_name: domain.from_name,
              is_default: domain.is_default,
            })),
          });
        }
      }
    }

    return accounts.sort((left, right) =>
      `${left.provider}:${left.account}`.localeCompare(
        `${right.provider}:${right.account}`,
        undefined,
        { numeric: true },
      ),
    );
  }

  /**
   * Resolves the concrete (provider, account) send target for a CampaignIntegration's
   * IntegrationAccount. Existing send-path helpers (getSmtpConfig, getResendApiKey, ...)
   * are keyed by (provider, account: string), not IntegrationAccount.uuid, so this is the
   * one place that bridges the FK-based sending-policy model back to those helpers.
   */
  async resolveTargetByAccountUuid(
    integration_account_uuid: string,
    domain_uuid?: string,
  ): Promise<EmailProviderTarget> {
    const account = await this.prisma.integrationAccount.findUnique({
      where: { uuid: integration_account_uuid },
      include: { integration: true, domains: true },
    });
    if (!account) {
      throw new NotFoundException(
        `Integration account ${integration_account_uuid} not found`,
      );
    }
    const provider = account.integration
      .provider as EmailProviderTarget['provider'];
    await this.assertSendableAccount(
      account.integration.organisation_uuid,
      provider,
      account.account,
    );

    if (domain_uuid) {
      if (provider !== ExternalIntegrationProvider.RESEND) {
        throw new BadRequestException(
          `${provider} accounts do not support domain selection`,
        );
      }
      const domainExists = account.domains.some(
        (row) => row.uuid === domain_uuid,
      );
      if (!domainExists) {
        throw new BadRequestException(
          `Domain ${domain_uuid} does not belong to account "${account.account}"`,
        );
      }
    }

    return { provider, account: account.account, domain_uuid };
  }

  async resolveDefaultTarget(
    organisation_uuid: string,
  ): Promise<EmailProviderTarget | null> {
    this.logger.log(`Resolving default email target user=${organisation_uuid}`);
    const integrations = await this.prisma.integration.findMany({
      where: {
        organisation_uuid,
        provider: { in: [...EMAIL_PROVIDERS] },
      },
      include: { keys: true, accounts: { include: { domains: true } } },
    });

    for (const provider of EMAIL_PROVIDERS) {
      const integration = integrations.find((row) => row.provider === provider);
      if (!integration) continue;
      const account = resolveEffectiveDefaultAccount(
        integration.default_account,
        integration.keys,
      );
      if (!account) continue;
      const domains =
        integration.accounts.find((row) => row.account === account)
          ?.domains ?? [];
      if (
        !this.isAccountComplete(provider, integration.keys, account, domains)
      ) {
        continue;
      }
      return { provider, account };
    }

    return null;
  }

  private isAccountComplete(
    provider: ExternalIntegrationProvider,
    keys: { key_type: IntegrationKeyType; account: string }[],
    account: string,
    domains: { uuid: string }[] = [],
  ): boolean {
    const accountKeys = keys.filter(
      (key) => key.account.trim() === account.trim(),
    );
    if (provider === ExternalIntegrationProvider.RESEND) {
      const hasApiKey = accountKeys.some(
        (key) => key.key_type === IntegrationKeyType.API_KEY,
      );
      const hasDomain = domains.length > 0;
      const hasLegacyFromEmail = accountKeys.some(
        (key) => key.key_type === IntegrationKeyType.FROM_EMAIL,
      );
      return hasApiKey && (hasDomain || hasLegacyFromEmail);
    }
    if (provider === ExternalIntegrationProvider.SMTP) {
      const required = requiredKeyTypesForProvider(
        ExternalIntegrationProvider.SMTP,
      );
      return required.every((key_type) =>
        accountKeys.some((key) => key.key_type === key_type),
      );
    }
    return false;
  }
}

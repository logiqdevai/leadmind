import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ExternalIntegrationProvider,
  IntegrationKeyType,
  MailTesterTest,
  MailTesterTestStatus,
  Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { EmailCredentialsService } from '@/modules/integrations/services/email-credentials.service';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { SmtpMailService } from '@/integrations/notifications/smtp/services/mail.service';
import { CreateEmail } from '@/integrations/notifications/sendgrid/interfaces/mail.interfaces';
import { formatSmtpFromAddress } from '@/integrations/notifications/smtp/utils/format-smtp-from-address.util';
import { EmailProviderTargetDto } from '@/modules/outreach/dto/email-provider.dto';
import { MailTesterClient } from '@/integrations/mail-tester/mail-tester.client';
import { MAIL_TESTER_EMAIL_DOMAIN } from '@/integrations/mail-tester/mail-tester.constants';
import { CreateMailTesterTestDto } from './dto/create-mail-tester-test.dto';

const MAIL_TESTER_TEST_LIST_LIMIT = 25;

@Injectable()
export class MailTesterService {
  private readonly logger = new Logger(MailTesterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly emailCredentialsService: EmailCredentialsService,
    private readonly mailTesterClient: MailTesterClient,
    private readonly resendMailService: ResendMailService,
    private readonly smtpMailService: SmtpMailService,
  ) {}

  async listTests(organisation_uuid: string): Promise<MailTesterTest[]> {
    return this.prisma.mailTesterTest.findMany({
      where: { organisation_uuid },
      orderBy: { created_at: 'desc' },
      take: MAIL_TESTER_TEST_LIST_LIMIT,
    });
  }

  async startTest(
    organisation_uuid: string,
    dto: CreateMailTesterTestDto,
  ): Promise<MailTesterTest> {
    const username = await this.getUsername(organisation_uuid);
    const testIdentifier = randomUUID().replace(/-/g, '').slice(0, 10);
    const testAddress = `${username}-${testIdentifier}@${MAIL_TESTER_EMAIL_DOMAIN}`;

    await this.sendTestEmail(organisation_uuid, dto.from, testAddress);

    this.logger.log(
      `Mail-Tester test started user=${organisation_uuid} address=${testAddress} provider=${dto.from.provider} account=${dto.from.account}`,
    );

    return this.prisma.mailTesterTest.create({
      data: {
        organisation_uuid,
        label: dto.label?.trim() || null,
        test_identifier: testIdentifier,
        test_address: testAddress,
        from_provider: dto.from.provider,
        from_account: dto.from.account.trim(),
        status: MailTesterTestStatus.PENDING,
      },
    });
  }

  async refreshResult(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MailTesterTest> {
    const row = await this.requireOwnedTest(organisation_uuid, uuid);
    const username = await this.getUsername(organisation_uuid);
    const result = await this.mailTesterClient.fetchResult(
      username,
      row.test_identifier,
    );

    if (result.status === true) {
      return this.prisma.mailTesterTest.update({
        where: { uuid },
        data: {
          status: MailTesterTestStatus.COMPLETED,
          score: typeof result.score === 'number' ? result.score : null,
          result: result as unknown as Prisma.InputJsonValue,
          error_message: null,
        },
      });
    }

    // Mail-Tester returns status:false both while the email hasn't been processed yet and on a
    // genuine failure - the JSON API doesn't distinguish the two, so this stays retryable rather
    // than being marked FAILED outright.
    return this.prisma.mailTesterTest.update({
      where: { uuid },
      data: {
        status: MailTesterTestStatus.PENDING,
        error_message:
          result.title ??
          'Not processed yet. Mail-Tester may still be waiting for the email to arrive.',
      },
    });
  }

  private async getUsername(organisation_uuid: string): Promise<string> {
    try {
      const username = await this.integrationsService.getDecryptedSecret(
        organisation_uuid,
        ExternalIntegrationProvider.MAILTESTER,
        IntegrationKeyType.USERNAME,
      );
      return username.trim();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          'Mail-Tester username is not configured. Add it under Integrations first.',
        );
      }
      throw error;
    }
  }

  private async requireOwnedTest(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MailTesterTest> {
    const row = await this.prisma.mailTesterTest.findFirst({
      where: { uuid, organisation_uuid },
    });
    if (!row) {
      throw new NotFoundException(`Mail-Tester test ${uuid} not found`);
    }
    return row;
  }

  private async sendTestEmail(
    organisation_uuid: string,
    target: EmailProviderTargetDto,
    to: string,
  ): Promise<void> {
    const createEmail: CreateEmail = {
      to,
      subject: 'Deliverability test',
      html: '<p>This is a Mail-Tester deliverability test email.</p>',
    };

    if (target.provider === ExternalIntegrationProvider.SMTP) {
      const smtpConfig = await this.emailCredentialsService.getSmtpConfig(
        organisation_uuid,
        target.account,
      );
      const from = formatSmtpFromAddress(
        smtpConfig.fromEmail,
        smtpConfig.fromName,
      );
      await this.smtpMailService.sendEmail({ ...createEmail, from }, smtpConfig);
      return;
    }

    const [apiKey, fromEmail] = await Promise.all([
      this.emailCredentialsService.getResendApiKey(
        organisation_uuid,
        target.account,
      ),
      this.emailCredentialsService.getResendFromEmail(
        organisation_uuid,
        target.account,
        target.domain_uuid,
      ),
    ]);
    await this.resendMailService.sendEmail(
      { ...createEmail, from: fromEmail },
      apiKey,
    );
  }
}

import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
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
import { MailTesterResult } from '@/integrations/mail-tester/interfaces/mail-tester.interface';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import {
  AiModels,
  AiProviders,
} from '@/integrations/ai/interfaces/ai.interface';
import { CreateMailTesterTestDto } from './dto/create-mail-tester-test.dto';

const MailTesterAuditSchema = z.object({
  summary: z
    .string()
    .describe(
      '2-3 sentence plain-English summary of the deliverability result and the main risk.',
    ),
  issues: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            'Short name of the problem, e.g. "DMARC alignment failure".',
          ),
        severity: z.enum(['high', 'medium', 'low']),
        fix: z
          .string()
          .describe(
            'Short, concrete fix instructions the sender can act on (1-3 sentences).',
          ),
      }),
    )
    .describe(
      'Issues found, ordered from most to least severe. Empty array if nothing to fix.',
    ),
});

export type MailTesterAiAudit = z.infer<typeof MailTesterAuditSchema>;

/**
 * Mail-Tester doesn't return a plain numeric score field - the final score only shows up
 * pre-formatted as `displayedMark` (e.g. "6.5/10"), with `mark` being the raw (usually negative)
 * penalty total it was derived from.
 */
function extractScore(result: MailTesterResult): number | null {
  if (typeof result.displayedMark === 'string') {
    const match = result.displayedMark.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }
  if (typeof result.mark === 'number') {
    return Math.round((10 + result.mark) * 10) / 10;
  }
  return null;
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return value;
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mail-Tester's raw result includes the full source email (headers, DKIM keys, HTML/text
 * duplicates) and a long per-blocklist breakdown - most of that is noise for an AI audit and
 * needlessly inflates the prompt. This keeps only the fields that actually drive the score.
 */
function buildAuditInput(result: MailTesterResult): Record<string, unknown> {
  return {
    score: extractScore(result),
    title: result.title,
    authentication: Object.fromEntries(
      Object.entries(result.signature?.subtests ?? {}).map(([key, check]) => [
        key,
        {
          status: check.status,
          statusClass: check.statusClass,
          title: stripHtml(check.title),
        },
      ]),
    ),
    spamAssassin: {
      score: result.spamAssassin?.score,
      threshold: result.spamAssassin?.threshold,
      rules: Object.values(result.spamAssassin?.rules ?? {}).map((rule) => ({
        code: rule.code,
        score: rule.score,
        description: stripHtml(rule.description),
      })),
    },
    content: Object.fromEntries(
      Object.entries(result.body?.subtests ?? {}).map(([key, check]) => [
        key,
        { statusClass: check.statusClass, title: stripHtml(check.title) },
      ]),
    ),
    blacklists: {
      hits: result.blacklists?.hits ?? 0,
      totalChecked: Object.keys(result.blacklists?.blacklists ?? {}).length,
    },
    links: {
      broken: result.links?.brokenLinks ?? 0,
      checked: result.links?.urls?.length ?? 0,
    },
  };
}

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
    private readonly aiService: AiService,
    private readonly aiCredentialsService: AiCredentialsService,
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
          score: extractScore(result),
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

  /**
   * Runs an AI audit over the most recently fetched result and overwrites the test's stored
   * audit - only the latest audit is kept, there is no history.
   */
  async runAiAudit(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MailTesterTest> {
    const row = await this.requireOwnedTest(organisation_uuid, uuid);
    const result = row.result as unknown as MailTesterResult | null;
    if (!result) {
      throw new BadRequestException(
        'Check results before requesting an AI audit.',
      );
    }

    await this.aiCredentialsService.assertOpenAiConfigured(organisation_uuid);

    const auditInput = buildAuditInput(result);
    const { response } = await this.aiService.generateObjectWithSchema({
      organisation_uuid,
      provider: AiProviders.openai,
      model: AiModels.openai.gpt4oMini,
      schema: MailTesterAuditSchema,
      system:
        'You are an email deliverability expert. Review the condensed Mail-Tester JSON report ' +
        'and produce a short, plain-English audit with concrete fix instructions for each issue ' +
        'found. Focus on authentication (SPF/DKIM/DMARC/rDNS), spam-filter rules, and blacklist ' +
        'hits. Do not restate the raw JSON.',
      prompt: `Mail-Tester report:\n\n${JSON.stringify(auditInput, null, 2)}`,
      usage: {
        operation: 'MAIL_TESTER_AUDIT',
        reference_type: 'mail_tester_test',
        reference_uuid: uuid,
      },
    });

    return this.prisma.mailTesterTest.update({
      where: { uuid },
      data: {
        ai_audit: response as unknown as Prisma.InputJsonValue,
        ai_audit_generated_at: new Date(),
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
      await this.smtpMailService.sendEmail(
        { ...createEmail, from },
        smtpConfig,
      );
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

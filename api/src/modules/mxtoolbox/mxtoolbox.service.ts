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
  MxToolboxCheck,
  MxToolboxCheckStatus,
  Prisma,
} from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { MxToolboxClient } from '@/integrations/mxtoolbox/mxtoolbox.client';
import {
  DEFAULT_DOMAIN_HEALTH_COMMANDS,
  MxToolboxCommand,
} from '@/integrations/mxtoolbox/mxtoolbox.constants';
import { MxToolboxLookupResult } from '@/integrations/mxtoolbox/interfaces/mxtoolbox.interface';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import {
  AiModels,
  AiProviders,
} from '@/integrations/ai/interfaces/ai.interface';
import { CreateMxToolboxCheckDto } from './dto/create-mxtoolbox-check.dto';

const MxToolboxAuditSchema = z.object({
  summary: z
    .string()
    .describe(
      '2-3 sentence plain-English summary of the domain health result and the main risk.',
    ),
  issues: z
    .array(
      z.object({
        title: z
          .string()
          .describe('Short name of the problem, e.g. "Missing DMARC record".'),
        severity: z.enum(['high', 'medium', 'low']),
        fix: z
          .string()
          .describe(
            'Short, concrete fix instructions the domain owner can act on (1-3 sentences).',
          ),
      }),
    )
    .describe(
      'Issues found, ordered from most to least severe. Empty array if nothing to fix.',
    ),
});

export type MxToolboxAiAudit = z.infer<typeof MxToolboxAuditSchema>;

interface CommandResult {
  argument: string;
  ok: boolean;
  error?: string;
  timeRecorded?: string;
  reportingNameServer?: string;
  failed: unknown[];
  warnings: unknown[];
  passed: unknown[];
  timeouts: unknown[];
}

type MxToolboxResults = Record<string, CommandResult>;

const MXTOOLBOX_CHECK_LIST_LIMIT = 25;

function resolveCommands(dto: CreateMxToolboxCheckDto): MxToolboxCommand[] {
  const requested = dto.commands?.length
    ? [...new Set(dto.commands)]
    : [...DEFAULT_DOMAIN_HEALTH_COMMANDS];

  if (dto.dkim_selector && !requested.includes('DKIM')) {
    requested.push('DKIM');
  }
  if (!dto.dkim_selector && requested.includes('DKIM')) {
    throw new BadRequestException(
      'dkim_selector is required to run the DKIM command',
    );
  }

  return requested;
}

function summarizeResults(results: MxToolboxResults): {
  status: MxToolboxCheckStatus;
  failed_count: number;
  warning_count: number;
} {
  let failed_count = 0;
  let warning_count = 0;
  let hasErrors = false;

  for (const result of Object.values(results)) {
    if (!result.ok) {
      hasErrors = true;
      continue;
    }
    failed_count += result.failed.length;
    warning_count += result.warnings.length;
  }

  const status =
    failed_count > 0
      ? MxToolboxCheckStatus.FAILED
      : warning_count > 0 || hasErrors
        ? MxToolboxCheckStatus.WARNING
        : MxToolboxCheckStatus.PASSED;

  return { status, failed_count, warning_count };
}

/**
 * Condenses the stored results (raw MxToolbox check-item arrays with Url/Info noise) down to
 * what actually matters for an AI audit prompt.
 */
function buildAuditInput(
  domain: string,
  results: MxToolboxResults,
): Record<string, unknown> {
  return {
    domain,
    checks: Object.fromEntries(
      Object.entries(results).map(([command, result]) => [
        command,
        result.ok
          ? {
              failed: result.failed,
              warnings: result.warnings,
              passed_count: result.passed.length,
            }
          : { error: result.error },
      ]),
    ),
  };
}

@Injectable()
export class MxToolboxService {
  private readonly logger = new Logger(MxToolboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationsService: IntegrationsService,
    private readonly mxToolboxClient: MxToolboxClient,
    private readonly aiService: AiService,
    private readonly aiCredentialsService: AiCredentialsService,
  ) {}

  async listChecks(organisation_uuid: string): Promise<MxToolboxCheck[]> {
    return this.prisma.mxToolboxCheck.findMany({
      where: { organisation_uuid },
      orderBy: { created_at: 'desc' },
      take: MXTOOLBOX_CHECK_LIST_LIMIT,
    });
  }

  async startCheck(
    organisation_uuid: string,
    dto: CreateMxToolboxCheckDto,
  ): Promise<MxToolboxCheck> {
    const commands = resolveCommands(dto);
    const apiKey = await this.getApiKey(organisation_uuid);
    const domain = dto.domain.trim().toLowerCase();

    const results = await this.runLookups(
      apiKey,
      domain,
      commands,
      dto.dkim_selector,
    );
    const { status, failed_count, warning_count } = summarizeResults(results);

    this.logger.log(
      `MxToolbox check started user=${organisation_uuid} domain=${domain} commands=${commands.join(',')} status=${status}`,
    );

    return this.prisma.mxToolboxCheck.create({
      data: {
        organisation_uuid,
        label: dto.label?.trim() || null,
        domain,
        commands,
        status,
        failed_count,
        warning_count,
        results: results as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async rerunCheck(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MxToolboxCheck> {
    const row = await this.requireOwnedCheck(organisation_uuid, uuid);
    const apiKey = await this.getApiKey(organisation_uuid);
    const dkimSelector = this.extractDkimSelector(
      row.results as unknown as MxToolboxResults,
    );

    const results = await this.runLookups(
      apiKey,
      row.domain,
      row.commands as MxToolboxCommand[],
      dkimSelector,
    );
    const { status, failed_count, warning_count } = summarizeResults(results);

    return this.prisma.mxToolboxCheck.update({
      where: { uuid },
      data: {
        status,
        failed_count,
        warning_count,
        results: results as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Runs an AI audit over the most recently fetched result and overwrites the check's stored
   * audit - only the latest audit is kept, there is no history.
   */
  async runAiAudit(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MxToolboxCheck> {
    const row = await this.requireOwnedCheck(organisation_uuid, uuid);

    await this.aiCredentialsService.assertOpenAiConfigured(organisation_uuid);

    const auditInput = buildAuditInput(
      row.domain,
      row.results as unknown as MxToolboxResults,
    );
    const { response } = await this.aiService.generateObjectWithSchema({
      organisation_uuid,
      provider: AiProviders.openai,
      model: AiModels.openai.gpt4oMini,
      schema: MxToolboxAuditSchema,
      system:
        'You are a DNS and email deliverability expert. Review the condensed MxToolbox domain ' +
        'health report and produce a short, plain-English audit with concrete fix instructions ' +
        'for each issue found. Focus on DNS/email authentication records (SPF/DKIM/DMARC/BIMI/' +
        'MTA-STS), blacklist hits, and connectivity failures. Do not restate the raw JSON.',
      prompt: `MxToolbox report:\n\n${JSON.stringify(auditInput, null, 2)}`,
      usage: {
        operation: 'MXTOOLBOX_AUDIT',
        reference_type: 'mxtoolbox_check',
        reference_uuid: uuid,
      },
    });

    return this.prisma.mxToolboxCheck.update({
      where: { uuid },
      data: {
        ai_audit: response as unknown as Prisma.InputJsonValue,
        ai_audit_generated_at: new Date(),
      },
    });
  }

  private async runLookups(
    apiKey: string,
    domain: string,
    commands: MxToolboxCommand[],
    dkimSelector?: string,
  ): Promise<MxToolboxResults> {
    const entries = await Promise.all(
      commands.map(async (command) => {
        const argument =
          command === 'DKIM' ? `${domain}:${dkimSelector}` : domain;
        try {
          const result = await this.mxToolboxClient.lookup(
            apiKey,
            command,
            argument,
          );
          return [command, this.toCommandResult(argument, result)] as const;
        } catch (error) {
          return [
            command,
            {
              argument,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              failed: [],
              warnings: [],
              passed: [],
              timeouts: [],
            } satisfies CommandResult,
          ] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
  }

  private toCommandResult(
    argument: string,
    result: MxToolboxLookupResult,
  ): CommandResult {
    return {
      argument,
      ok: true,
      timeRecorded: result.TimeRecorded,
      reportingNameServer: result.ReportingNameServer,
      failed: result.Failed ?? [],
      warnings: result.Warnings ?? [],
      passed: result.Passed ?? [],
      timeouts: result.Timeouts ?? [],
    };
  }

  private extractDkimSelector(results: MxToolboxResults): string | undefined {
    const dkimArgument = results.DKIM?.argument;
    if (!dkimArgument?.includes(':')) return undefined;
    return dkimArgument.split(':').slice(1).join(':');
  }

  private async getApiKey(organisation_uuid: string): Promise<string> {
    try {
      const apiKey = await this.integrationsService.getDecryptedSecret(
        organisation_uuid,
        ExternalIntegrationProvider.MXTOOLBOX,
        IntegrationKeyType.API_KEY,
      );
      return apiKey.trim();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          'MxToolbox API key is not configured. Add it under Integrations first.',
        );
      }
      throw error;
    }
  }

  private async requireOwnedCheck(
    organisation_uuid: string,
    uuid: string,
  ): Promise<MxToolboxCheck> {
    const row = await this.prisma.mxToolboxCheck.findFirst({
      where: { uuid, organisation_uuid },
    });
    if (!row) {
      throw new NotFoundException(`MxToolbox check ${uuid} not found`);
    }
    return row;
  }
}

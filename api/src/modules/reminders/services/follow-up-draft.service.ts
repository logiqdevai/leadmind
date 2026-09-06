import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import { AiModels, AiProviders } from '@/integrations/ai/interfaces/ai.interface';
import {
    FollowUpDraftSystemPrompt,
    buildFollowUpDraftPrompt,
} from '../constants/follow-up-draft-prompts';
import { FOLLOW_UP_DRAFT_SCHEMA, FollowUpDraftResult } from '../schemas/follow-up-draft.schema';

@Injectable()
export class FollowUpDraftService {
    private readonly logger = new Logger(FollowUpDraftService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly aiCredentials: AiCredentialsService,
    ) {}

    /** Drafts a personalized follow-up from the contact's recent email history, or null if AI isn't configured/available. */
    async draftFollowUp(
        organisation_uuid: string,
        contact_uuid: string,
    ): Promise<FollowUpDraftResult | null> {
        const hasKey = await this.aiCredentials.hasOpenAiApiKey(organisation_uuid);
        if (!hasKey) {
            this.logger.log(
                `[draftFollowUp] org=${organisation_uuid} has no OpenAI key configured, skipping draft`,
            );
            return null;
        }

        const contact = await this.prisma.contact.findUnique({
            where: { uuid: contact_uuid },
            select: { name: true, company: true },
        });
        if (!contact) return null;

        const recentMessages = await this.prisma.outreachMessage.findMany({
            where: { contact_uuid, organisation_uuid, channel: Channel.EMAIL },
            orderBy: { created_at: 'desc' },
            take: 10,
            select: {
                subject: true,
                content: true,
                reply_subject: true,
                reply_text: true,
            },
        });
        if (recentMessages.length === 0) return null;

        const messages = [...recentMessages].reverse();
        const transcript = this.buildTranscript(messages);
        const lastSubject =
            [...messages].reverse().map((m) => m.reply_subject ?? m.subject).find(Boolean) ?? null;

        try {
            const { response } = await this.aiService.generateObjectWithSchema<FollowUpDraftResult>({
                organisation_uuid,
                provider: AiProviders.openai,
                model: AiModels.openai.gpt4oMini,
                schema: FOLLOW_UP_DRAFT_SCHEMA,
                system: FollowUpDraftSystemPrompt,
                prompt: buildFollowUpDraftPrompt({
                    now: new Date(),
                    contactName: contact.name,
                    contactCompany: contact.company,
                    subject: lastSubject,
                    transcript,
                }),
                usage: {
                    operation: 'FOLLOW_UP_DRAFT',
                    reference_type: 'contact',
                    reference_uuid: contact_uuid,
                },
            });
            return response;
        } catch (error) {
            this.logger.error(
                `[draftFollowUp] AI draft failed for contact=${contact_uuid}: ${error instanceof Error ? error.message : error}`,
            );
            return null;
        }
    }

    private buildTranscript(
        messages: {
            subject: string | null;
            content: string;
            reply_subject: string | null;
            reply_text: string | null;
        }[],
    ): string {
        const parts: string[] = [];
        for (const m of messages) {
            const plainOutbound = m.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (plainOutbound) {
                parts.push(`US: ${plainOutbound.slice(0, 1500)}`);
            }
            if (m.reply_text?.trim()) {
                parts.push(`THEM: ${m.reply_text.trim().slice(0, 1500)}`);
            }
        }
        return parts.join('\n\n');
    }
}

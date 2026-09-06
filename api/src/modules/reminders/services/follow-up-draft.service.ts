import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import { AiModels, AiProviders } from '@/integrations/ai/interfaces/ai.interface';
import {
    buildEmailTranscript,
    fetchRecentEmailMessages,
} from '@/shared/utils/email-thread-transcript.util';
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

        const messages = await fetchRecentEmailMessages(this.prisma, organisation_uuid, contact_uuid);
        if (messages.length === 0) return null;

        const transcript = buildEmailTranscript(messages);
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
}

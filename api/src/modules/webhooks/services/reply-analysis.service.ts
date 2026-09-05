import { Injectable, Logger } from '@nestjs/common';
import { InteractionType, ReminderSource, ReminderType } from '@/generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AiService } from '@/integrations/ai/services/ai.service';
import { AiCredentialsService } from '@/integrations/ai/services/ai-credentials.service';
import { AiModels, AiProviders } from '@/integrations/ai/interfaces/ai.interface';
import { RemindersService } from '@/modules/reminders/reminders.service';
import {
    ReplyAnalysisSystemPrompt,
    buildReplyAnalysisPrompt,
} from '../constants/reply-analysis-prompts';
import { REPLY_ANALYSIS_SCHEMA, ReplyAnalysisResult } from '../schemas/reply-analysis.schema';

@Injectable()
export class ReplyAnalysisService {
    private readonly logger = new Logger(ReplyAnalysisService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly aiCredentials: AiCredentialsService,
        private readonly remindersService: RemindersService,
    ) {}

    async analyzeReply(message_uuid: string, note_uuid: string): Promise<void> {
        const message = await this.prisma.outreachMessage.findUnique({
            where: { uuid: message_uuid },
        });
        if (!message || !message.reply_text?.trim()) {
            this.logger.warn(
                `[analyzeReply] message=${message_uuid} missing or has no reply_text, skipping`,
            );
            return;
        }

        const contact = await this.prisma.contact.findUnique({
            where: { uuid: message.contact_uuid },
            select: { name: true, company: true, title: true },
        });

        const hasKey = await this.aiCredentials.hasOpenAiApiKey(message.organisation_uuid);
        let analysis: ReplyAnalysisResult | null = null;

        if (hasKey) {
            try {
                const { response } = await this.aiService.generateObjectWithSchema<ReplyAnalysisResult>({
                    organisation_uuid: message.organisation_uuid,
                    provider: AiProviders.openai,
                    model: AiModels.openai.gpt4oMini,
                    schema: REPLY_ANALYSIS_SCHEMA,
                    system: ReplyAnalysisSystemPrompt,
                    prompt: buildReplyAnalysisPrompt({
                        now: new Date(),
                        contactName: contact?.name,
                        contactCompany: contact?.company,
                        contactTitle: contact?.title,
                        originalSubject: message.subject,
                        originalContent: message.content,
                        replySubject: message.reply_subject,
                        replyText: message.reply_text,
                    }),
                    usage: {
                        operation: 'REPLY_ANALYSIS',
                        reference_type: 'outreach_message',
                        reference_uuid: message.uuid,
                    },
                });
                analysis = response;
            } catch (error) {
                this.logger.error(
                    `[analyzeReply] AI analysis failed for message=${message_uuid}: ${error instanceof Error ? error.message : error}`,
                );
            }
        } else {
            this.logger.log(
                `[analyzeReply] org=${message.organisation_uuid} has no OpenAI key configured, leaving fallback note`,
            );
        }

        if (analysis) {
            await this.updateNoteWithAnalysis(note_uuid, analysis);

            if (analysis.should_create_reminder) {
                await this.maybeCreateReminder(
                    message.organisation_uuid,
                    message.contact_uuid,
                    analysis,
                );
            }
        }
    }

    private async updateNoteWithAnalysis(
        note_uuid: string,
        analysis: ReplyAnalysisResult,
    ): Promise<void> {
        try {
            await this.prisma.interaction.update({
                where: { uuid: note_uuid },
                data: {
                    type: InteractionType.NOTE,
                    content: analysis.summary,
                    metadata: { source: 'ai', sentiment: analysis.sentiment ?? null },
                },
            });
        } catch (error) {
            this.logger.error(
                `[analyzeReply] Failed to update note=${note_uuid} with AI summary: ${error instanceof Error ? error.message : error}`,
            );
        }
    }

    private async maybeCreateReminder(
        organisation_uuid: string,
        contact_uuid: string,
        analysis: ReplyAnalysisResult,
    ): Promise<void> {
        const remindAt = analysis.remind_at ? new Date(analysis.remind_at) : null;
        if (!remindAt || Number.isNaN(remindAt.getTime()) || remindAt <= new Date()) {
            this.logger.warn(
                `[analyzeReply] AI proposed an invalid/past remind_at="${analysis.remind_at}" for contact=${contact_uuid}, skipping reminder creation`,
            );
            return;
        }

        try {
            await this.remindersService.create(
                organisation_uuid,
                {
                    contact_uuid,
                    title: analysis.reminder_title?.trim() || 'Follow up on reply',
                    notes: analysis.reminder_notes?.trim() || analysis.summary,
                    remind_at: remindAt.toISOString(),
                },
                {
                    source: ReminderSource.AI,
                    type: (analysis.reminder_type as ReminderType) ?? ReminderType.GENERAL,
                },
            );
        } catch (error) {
            this.logger.error(
                `[analyzeReply] Failed to create AI reminder for contact=${contact_uuid}: ${error instanceof Error ? error.message : error}`,
            );
        }
    }
}

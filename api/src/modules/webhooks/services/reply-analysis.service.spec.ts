/// <reference types="jest" />
import { ReminderSource, ReminderType } from '@/generated/prisma';
import { ReplyAnalysisService } from './reply-analysis.service';

describe('ReplyAnalysisService', () => {
    const organisation_uuid = 'org-uuid';
    const message_uuid = 'msg-uuid';
    const note_uuid = 'note-uuid';
    const baseMessage = {
        uuid: message_uuid,
        organisation_uuid,
        contact_uuid: 'contact-uuid',
        campaign_uuid: 'campaign-uuid',
        subject: 'Original subject',
        content: 'Original content',
        reply_subject: 'Re: Original subject',
        reply_text: 'Sounds good, call me Tuesday afternoon',
    };

    function createService(overrides?: {
        message?: Record<string, unknown> | null;
        hasOpenAiApiKey?: boolean;
        aiResponse?: Record<string, unknown> | Error;
    }) {
        const message = overrides?.message === null ? null : { ...baseMessage, ...overrides?.message };

        const prisma = {
            outreachMessage: {
                findUnique: jest.fn().mockResolvedValue(message),
            },
            contact: {
                findUnique: jest.fn().mockResolvedValue({ name: 'Jane Doe', company: 'Acme', title: 'CEO' }),
            },
            interaction: {
                update: jest.fn().mockResolvedValue({}),
            },
        };

        const aiService = {
            generateObjectWithSchema: jest.fn(async () => {
                if (overrides?.aiResponse instanceof Error) throw overrides.aiResponse;
                return {
                    response: overrides?.aiResponse ?? { summary: 'default summary', should_create_reminder: false },
                    usage: {},
                };
            }),
        };

        const aiCredentials = {
            hasOpenAiApiKey: jest.fn().mockResolvedValue(overrides?.hasOpenAiApiKey ?? true),
        };

        const remindersService = {
            create: jest.fn().mockResolvedValue({}),
        };

        return {
            service: new ReplyAnalysisService(
                prisma as any,
                aiService as any,
                aiCredentials as any,
                remindersService as any,
            ),
            prisma,
            aiService,
            aiCredentials,
            remindersService,
        };
    }

    it('creates an AI-summarized note and a reminder when the AI recommends one', async () => {
        const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { service, prisma, remindersService } = createService({
            aiResponse: {
                summary: 'Contact wants a call Tuesday afternoon',
                sentiment: 'positive',
                should_create_reminder: true,
                reminder_title: 'Call contact',
                reminder_notes: 'They asked for a call',
                reminder_type: 'CALL',
                remind_at: futureDate,
            },
        });

        await service.analyzeReply(message_uuid, note_uuid);

        expect(prisma.interaction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { uuid: note_uuid },
                data: expect.objectContaining({
                    content: 'Contact wants a call Tuesday afternoon',
                    metadata: { source: 'ai', sentiment: 'positive' },
                }),
            }),
        );
        expect(remindersService.create).toHaveBeenCalledWith(
            organisation_uuid,
            expect.objectContaining({
                contact_uuid: 'contact-uuid',
                title: 'Call contact',
                notes: 'They asked for a call',
                remind_at: futureDate,
            }),
            { source: ReminderSource.AI, type: ReminderType.CALL },
        );
    });

    it('creates only the note, no reminder, when should_create_reminder is false', async () => {
        const { service, prisma, remindersService } = createService({
            aiResponse: { summary: 'Not interested, please remove', should_create_reminder: false },
        });

        await service.analyzeReply(message_uuid, note_uuid);

        expect(prisma.interaction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ content: 'Not interested, please remove' }),
            }),
        );
        expect(remindersService.create).not.toHaveBeenCalled();
    });

    it('falls back to leaving the placeholder note untouched when the org has no OpenAI key', async () => {
        const { service, prisma, aiService, remindersService } = createService({
            hasOpenAiApiKey: false,
        });

        await service.analyzeReply(message_uuid, note_uuid);

        expect(aiService.generateObjectWithSchema).not.toHaveBeenCalled();
        expect(prisma.interaction.update).not.toHaveBeenCalled();
        expect(remindersService.create).not.toHaveBeenCalled();
    });

    it('falls back to leaving the placeholder note untouched when the AI call throws', async () => {
        const { service, prisma, remindersService } = createService({
            aiResponse: new Error('AI provider timeout'),
        });

        await expect(service.analyzeReply(message_uuid, note_uuid)).resolves.toBeUndefined();

        expect(prisma.interaction.update).not.toHaveBeenCalled();
        expect(remindersService.create).not.toHaveBeenCalled();
    });

    it('skips reminder creation when the AI proposes a past or unparseable remind_at', async () => {
        const { service, remindersService } = createService({
            aiResponse: {
                summary: 'Wants a follow up',
                should_create_reminder: true,
                remind_at: 'not-a-date',
            },
        });

        await service.analyzeReply(message_uuid, note_uuid);

        expect(remindersService.create).not.toHaveBeenCalled();
    });

    it('does nothing when the message has no reply_text', async () => {
        const { service, prisma, aiService, remindersService } = createService({
            message: { reply_text: null },
        });

        await service.analyzeReply(message_uuid, note_uuid);

        expect(aiService.generateObjectWithSchema).not.toHaveBeenCalled();
        expect(prisma.interaction.update).not.toHaveBeenCalled();
        expect(remindersService.create).not.toHaveBeenCalled();
    });
});

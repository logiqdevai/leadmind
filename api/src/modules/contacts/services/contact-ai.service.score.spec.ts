import { Contact, Lead } from '@/generated/prisma';
import { ContactAiService } from './contact-ai.service';

describe('ContactAiService.scoreContact (Jev)', () => {
    const contact = { uuid: 'c1', organisation_uuid: 'org1', name: 'Ada' } as Contact;
    const lead = {} as Lead;
    const instructions = [
        { uuid: 'i1', instructions: 'Founders only' },
        { uuid: 'i2', instructions: 'Greek market' },
    ];

    function build(existing: Array<{ scoring_instruction_uuid: string }> = []) {
        const prisma = {
            scoringInstruction: { findMany: jest.fn().mockResolvedValue(instructions) },
            contactScore: {
                findMany: jest.fn().mockResolvedValue(existing),
                upsert: jest.fn().mockResolvedValue({}),
            },
            contact: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        const jevClient = {
            decide: jest.fn().mockResolvedValue({
                model: 'jev-1.14.0',
                usage: { input_tokens: 100_000, output_tokens: 10 },
                answers: {
                    i1: { type: 'score', score: 8.6, confidence: 0.9 },
                    i2: { type: 'score', score: 0.2, confidence: 0.8 },
                },
            }),
        };
        const aiUsageService = { log: jest.fn() };
        const service = new ContactAiService(
            prisma as never,
            {} as never,
            {} as never,
            { indexContact: jest.fn() } as never,
            {} as never,
            aiUsageService as never,
            {} as never,
            {} as never,
            jevClient as never,
        );
        return { service, prisma, jevClient, aiUsageService };
    }

    it('scores all pending instructions with a single Jev call', async () => {
        const { service, prisma, jevClient, aiUsageService } = build();

        const result = await service.scoreContact(contact, lead, null, {
            onlyInstructionUuids: ['i1', 'i2'],
        });

        expect(result).toEqual({ scored: 2 });
        expect(jevClient.decide).toHaveBeenCalledTimes(1);
        const upserts = prisma.contactScore.upsert.mock.calls.map(([arg]) => arg.create.score);
        expect(upserts).toEqual([10, 1]);
        expect(aiUsageService.log).toHaveBeenCalledWith(
            expect.objectContaining({ provider: 'typesafe', status: 'SUCCESS', input_tokens: 100_000 }),
        );
        expect(aiUsageService.log.mock.calls[0][0].total_cost_usd).toBeCloseTo(0.0042, 8);
    });

    it('counts an instruction missing from the response as not scored', async () => {
        const { service, jevClient } = build();
        jevClient.decide.mockResolvedValue({
            model: 'm',
            usage: { input_tokens: 1, output_tokens: 1 },
            answers: { i1: { type: 'score', score: 3, confidence: 0.5 } },
        });

        const result = await service.scoreContact(contact, lead, null, {
            onlyInstructionUuids: ['i1', 'i2'],
        });

        expect(result).toEqual({ scored: 1 });
    });

    it('logs the failure and rethrows when Jev errors', async () => {
        const { service, jevClient, aiUsageService, prisma } = build();
        jevClient.decide.mockRejectedValue(new Error('boom'));

        await expect(
            service.scoreContact(contact, lead, null, { onlyInstructionUuids: ['i1', 'i2'] }),
        ).rejects.toThrow('boom');
        expect(aiUsageService.log).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'ERROR', error_message: 'boom' }),
        );
        expect(prisma.contactScore.upsert).not.toHaveBeenCalled();
    });

    it('skips instructions that are already scored unless rescoring explicitly', async () => {
        const { service, jevClient } = build([{ scoring_instruction_uuid: 'i1' }, { scoring_instruction_uuid: 'i2' }]);
        const filter = {
            filter_scoring_instructions: instructions.map((scoring_instruction) => ({ scoring_instruction })),
        };

        const result = await service.scoreContact(contact, lead, filter as never);

        expect(result).toEqual({ scored: 0 });
        expect(jevClient.decide).not.toHaveBeenCalled();
    });
});

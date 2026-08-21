import { SendingPeriodUnit } from '@/generated/prisma';
import { SendingStageResolverService } from './sending-stage-resolver.service';

type StageInput = {
    uuid: string;
    order_index: number;
    limit: number;
    period_unit: SendingPeriodUnit;
    duration_value: number | null;
    duration_unit: SendingPeriodUnit | null;
};

function stage(
    order_index: number,
    limit: number,
    duration_value: number | null,
    duration_unit: SendingPeriodUnit | null = SendingPeriodUnit.DAY,
    period_unit: SendingPeriodUnit = SendingPeriodUnit.DAY,
): StageInput {
    return {
        uuid: `stage-${order_index}`,
        order_index,
        limit,
        period_unit,
        duration_value,
        duration_unit,
    };
}

describe('SendingStageResolverService', () => {
    const resolver = new SendingStageResolverService();
    const started = new Date('2026-01-01T00:00:00.000Z');

    // 30/day x 3 days -> 40/day x 5 days -> 50/day until complete
    const stages = [
        stage(0, 30, 3),
        stage(1, 40, 5),
        stage(2, 50, null, null),
    ] as any;

    it('resolves stage 1 at policy start', () => {
        const resolved = resolver.resolveCurrentStage(stages, started, started);
        expect(resolved?.stage.order_index).toBe(0);
        expect(resolved?.is_final_stage).toBe(false);
        expect(resolved?.stage_elapsed_ms).toBe(0);
    });

    it('resolves stage 1 just before its boundary', () => {
        const now = new Date(started.getTime() + 3 * 24 * 60 * 60 * 1000 - 1);
        const resolved = resolver.resolveCurrentStage(stages, started, now);
        expect(resolved?.stage.order_index).toBe(0);
    });

    it('resolves stage 2 exactly at its boundary', () => {
        const now = new Date(started.getTime() + 3 * 24 * 60 * 60 * 1000);
        const resolved = resolver.resolveCurrentStage(stages, started, now);
        expect(resolved?.stage.order_index).toBe(1);
        expect(resolved?.stage_elapsed_ms).toBe(0);
    });

    it('resolves stage 2 mid-stage', () => {
        const now = new Date(started.getTime() + 5 * 24 * 60 * 60 * 1000);
        const resolved = resolver.resolveCurrentStage(stages, started, now);
        expect(resolved?.stage.order_index).toBe(1);
        expect(resolved?.next_stage_at?.getTime()).toBe(
            started.getTime() + 8 * 24 * 60 * 60 * 1000,
        );
    });

    it('resolves the final indefinite stage well past all durations', () => {
        const now = new Date(started.getTime() + 100 * 24 * 60 * 60 * 1000);
        const resolved = resolver.resolveCurrentStage(stages, started, now);
        expect(resolved?.stage.order_index).toBe(2);
        expect(resolved?.is_final_stage).toBe(true);
        expect(resolved?.next_stage_at).toBeNull();
    });

    it('treats a single flat stage as always final', () => {
        const flat = [stage(0, 50, null, null)] as any;
        const resolved = resolver.resolveCurrentStage(flat, started, started);
        expect(resolved?.is_final_stage).toBe(true);
        expect(resolved?.stage.limit).toBe(50);
    });

    it('returns null for an empty stage list', () => {
        expect(resolver.resolveCurrentStage([], started, started)).toBeNull();
    });

    describe('previewSchedule', () => {
        it('projects contact counts across bounded stages and estimates completion', () => {
            const preview = resolver.previewSchedule(stages, 1000, started);
            expect(preview.entries).toHaveLength(3);
            expect(preview.entries[0].estimated_messages).toBe(90); // 30/day * 3 days
            expect(preview.entries[1].estimated_messages).toBe(200); // 40/day * 5 days
            expect(preview.entries[2].is_final_stage).toBe(true);
            expect(preview.entries[2].estimated_messages).toBe(1000 - 90 - 200);
            expect(preview.estimated_completion_at).not.toBeNull();
        });

        it('completes within a bounded stage when the audience is small', () => {
            const preview = resolver.previewSchedule(stages, 10, started);
            expect(preview.entries).toHaveLength(1);
            expect(preview.entries[0].estimated_messages).toBe(10);
            expect(preview.estimated_completion_at?.getTime()).toBe(
                started.getTime() + (10 / 30) * 24 * 60 * 60 * 1000,
            );
        });
    });
});

import type { SendingPolicyStage } from "../interfaces/sending-policy.interface";

/** Renders a policy's stages as a compact "30/day × 3 days → 40/day × 5 days → 50/day" summary. */
export function formatSendingPolicyStages(policy: { stages: SendingPolicyStage[] }): string {
    const ordered = [...policy.stages].sort((a, b) => a.order_index - b.order_index);
    return ordered
        .map((stage) => {
            const rate = `${stage.limit}/${stage.period_unit.toLowerCase()}`;
            if (stage.duration_value == null || stage.duration_unit == null) return rate;
            return `${rate} × ${stage.duration_value} ${stage.duration_unit.toLowerCase()}${stage.duration_value === 1 ? "" : "s"}`;
        })
        .join(" → ");
}

import {
    SequenceDelayReference,
    SequenceDelayUnit,
    type SequenceStep,
} from "../interfaces/sequence.interface";

const UNIT_LABEL: Record<SequenceDelayUnit, { one: string; many: string }> = {
    [SequenceDelayUnit.HOURS]: { one: "hour", many: "hours" },
    [SequenceDelayUnit.DAYS]: { one: "day", many: "days" },
    [SequenceDelayUnit.WEEKS]: { one: "week", many: "weeks" },
    [SequenceDelayUnit.MONTHS]: { one: "month", many: "months" },
};

export function formatStepDelay(step: SequenceStep, isFirstEnabledStep: boolean): string {
    if (isFirstEnabledStep) {
        if (step.delay_value === 0) return "Sent immediately on enrollment";
        const label = UNIT_LABEL[step.delay_unit];
        const unit = step.delay_value === 1 ? label.one : label.many;
        return `${step.delay_value} ${unit} after enrollment`;
    }
    const label = UNIT_LABEL[step.delay_unit];
    const unit = step.delay_value === 1 ? label.one : label.many;
    const reference =
        step.delay_reference === SequenceDelayReference.FIRST_STEP ? "the first message" : "the previous message";
    if (step.delay_value === 0) return `Sent immediately after ${reference}`;
    return `${step.delay_value} ${unit} after ${reference}`;
}

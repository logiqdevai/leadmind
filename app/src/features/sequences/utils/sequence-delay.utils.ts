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

function formatSendTime(send_time: string): string {
    const [hours, minutes] = send_time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatStepDelay(step: SequenceStep, isFirstEnabledStep: boolean): string {
    const timeSuffix = step.send_time ? ` at ${formatSendTime(step.send_time)}` : "";

    if (isFirstEnabledStep) {
        if (step.delay_value === 0) {
            return step.send_time ? `Sent on enrollment day${timeSuffix}` : "Sent immediately on enrollment";
        }
        const label = UNIT_LABEL[step.delay_unit];
        const unit = step.delay_value === 1 ? label.one : label.many;
        return `${step.delay_value} ${unit} after enrollment${timeSuffix}`;
    }
    const label = UNIT_LABEL[step.delay_unit];
    const unit = step.delay_value === 1 ? label.one : label.many;
    const reference =
        step.delay_reference === SequenceDelayReference.FIRST_STEP ? "the first message" : "the previous message";
    if (step.delay_value === 0) {
        return step.send_time ? `Sent${timeSuffix} on the day of ${reference}` : `Sent immediately after ${reference}`;
    }
    return `${step.delay_value} ${unit} after ${reference}${timeSuffix}`;
}

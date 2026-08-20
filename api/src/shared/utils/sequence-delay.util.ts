import { SequenceDelayUnit } from '@/generated/prisma';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export function addDelay(
    base: Date,
    value: number,
    unit: SequenceDelayUnit,
): Date {
    switch (unit) {
        case SequenceDelayUnit.HOURS:
            return new Date(base.getTime() + value * MS_PER_HOUR);
        case SequenceDelayUnit.DAYS:
            return new Date(base.getTime() + value * MS_PER_DAY);
        case SequenceDelayUnit.WEEKS:
            return new Date(base.getTime() + value * MS_PER_WEEK);
        case SequenceDelayUnit.MONTHS: {
            const result = new Date(base.getTime());
            result.setMonth(result.getMonth() + value);
            return result;
        }
        default:
            return new Date(base.getTime());
    }
}

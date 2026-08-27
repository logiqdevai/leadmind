import { normalizeDailyLimit } from "@/features/sending-policy/utils/sending-policy-validation";
import type { SendingPolicyStage } from "@/features/sending-policy/interfaces/sending-policy.interface";
import type { CampaignIntegrationCapacity } from "../interfaces/campaign-integration.interface";

const DISPLAY_DAYS = 14;
const SIMULATION_HORIZON_DAYS = 180;

export interface ForecastAccountInput {
    campaign_integration_uuid: string;
    stages: SendingPolicyStage[];
    /** Live snapshot of where this account is right now - used for an accurate "today", and to
     * skip stages it has already moved past. Omit for an account with no send history yet
     * (e.g. still being configured), which simply starts at stage 0. */
    capacity?: Pick<CampaignIntegrationCapacity, "current_stage" | "stage_remaining"> | null;
}

export interface ForecastDay {
    date: string;
    count: number;
}

export interface SendingForecast {
    byAccount: Record<string, { days: ForecastDay[]; total: number }>;
    totalByDay: ForecastDay[];
    /** Days until the shared contact pool is fully drained at the projected pace, or null if it
     * won't finish within the simulation horizon. */
    completesInDays: number | null;
}

const DAYS_PER_UNIT: Record<SendingPolicyStage["period_unit"], number> = {
    HOUR: 1 / 24,
    DAY: 1,
    WEEK: 7,
};

/** Whole days a finite stage lasts, or null for the final/indefinite stage. */
function stageDurationDays(stage: SendingPolicyStage): number | null {
    if (stage.duration_value == null || stage.duration_unit == null) return null;
    return Math.max(1, Math.round(stage.duration_value * DAYS_PER_UNIT[stage.duration_unit]));
}

function toISODate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface AccountPlan {
    uuid: string;
    /** Today's real remaining send room, when known - falls back to the first stage's rate. */
    day0Capacity: number;
    stages: SendingPolicyStage[];
    stagePos: number;
    /** Whole days elapsed within the current stage, not counting "today". */
    stageDayCursor: number;
}

function buildPlan(account: ForecastAccountInput): AccountPlan {
    const ordered = [...account.stages].sort((a, b) => a.order_index - b.order_index);
    const currentOrderIndex = account.capacity?.current_stage?.order_index;
    const startIndex =
        currentOrderIndex != null
            ? Math.max(
                  0,
                  ordered.findIndex((s) => s.order_index === currentOrderIndex),
              )
            : 0;
    const remaining = ordered.slice(startIndex);
    const stages = remaining.length ? remaining : ordered.slice(-1);
    const current = stages[0];
    const day0Capacity =
        account.capacity?.stage_remaining ??
        (current ? normalizeDailyLimit(current.limit, current.period_unit) : 0);

    return {
        uuid: account.campaign_integration_uuid,
        day0Capacity,
        stages,
        stagePos: 0,
        stageDayCursor: 0,
    };
}

/** This day's raw (fractional) capacity for a plan, advancing it past any finite stage whose
 * approximated duration has elapsed. Day 0 always uses the plan's accurate day0Capacity. */
function dailyCapacity(plan: AccountPlan, day: number): number {
    if (day === 0) return plan.day0Capacity;

    while (plan.stagePos < plan.stages.length - 1) {
        const duration = stageDurationDays(plan.stages[plan.stagePos]);
        if (duration == null || plan.stageDayCursor < duration) break;
        plan.stagePos += 1;
        plan.stageDayCursor = 0;
    }

    const stage = plan.stages[plan.stagePos];
    plan.stageDayCursor += 1;
    return stage ? normalizeDailyLimit(stage.limit, stage.period_unit) : 0;
}

/**
 * Projects, per account, how many emails it will send each of the next few days - each account
 * ramping through its own sending-policy stages independently, but all of them drawing down the
 * SAME shared pool of remaining contacts (matching how SendingEngineService actually dispatches:
 * every eligible account claims sends every tick until the campaign's contacts run out, not a
 * fixed upfront per-account split). Approximation: since the frontend doesn't know exactly how
 * many days into its current stage an account already is, day 0 uses its real live remaining
 * capacity, but day 1+ assumes a fresh full duration for that stage - a conservative estimate
 * that can show a ramp-up transition slightly later than it actually happens, never earlier.
 */
export function computeSendingForecast(
    accounts: ForecastAccountInput[],
    totalContactsRemaining: number,
): SendingForecast {
    const byAccount: SendingForecast["byAccount"] = {};
    for (const a of accounts) byAccount[a.campaign_integration_uuid] = { days: [], total: 0 };

    if (accounts.length === 0 || totalContactsRemaining <= 0) {
        return { byAccount, totalByDay: [], completesInDays: totalContactsRemaining <= 0 ? 0 : null };
    }

    const plans = accounts.map(buildPlan);
    let remainingPool = totalContactsRemaining;
    const totalByDay: ForecastDay[] = [];
    let completesInDays: number | null = null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 0; day < SIMULATION_HORIZON_DAYS && remainingPool > 0; day++) {
        const caps = plans.map((p) => Math.max(0, Math.floor(dailyCapacity(p, day))));
        const totalCapacityToday = caps.reduce((sum, c) => sum + c, 0);

        if (totalCapacityToday <= 0) {
            if (day === 0) break; // nothing can ever send - avoid spinning through the whole horizon
            continue;
        }

        const sentToday = Math.min(totalCapacityToday, remainingPool);
        const perAccount =
            sentToday === totalCapacityToday ? caps : distributeProportionally(caps, sentToday);

        if (day < DISPLAY_DAYS) {
            const date = new Date(today);
            date.setDate(date.getDate() + day);
            const iso = toISODate(date);
            plans.forEach((p, i) => {
                byAccount[p.uuid].days.push({ date: iso, count: perAccount[i] });
                byAccount[p.uuid].total += perAccount[i];
            });
            totalByDay.push({ date: iso, count: sentToday });
        } else {
            plans.forEach((p, i) => {
                byAccount[p.uuid].total += perAccount[i];
            });
        }

        remainingPool -= sentToday;
        if (remainingPool <= 0) completesInDays = day + 1;
    }

    return { byAccount, totalByDay, completesInDays };
}

/** Largest-remainder rounding, so the parts are whole numbers that still sum exactly to `total`. */
function distributeProportionally(weights: number[], total: number): number[] {
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    if (weightSum <= 0) return weights.map(() => 0);

    const raw = weights.map((w) => (w / weightSum) * total);
    const floors = raw.map(Math.floor);
    const distributed = floors.reduce((sum, v) => sum + v, 0);
    const remainder = total - distributed;

    const byFractionDesc = raw
        .map((v, i) => ({ i, frac: v - floors[i] }))
        .sort((a, b) => b.frac - a.frac);

    for (let k = 0; k < remainder && k < byFractionDesc.length; k++) {
        floors[byFractionDesc[k].i] += 1;
    }
    return floors;
}

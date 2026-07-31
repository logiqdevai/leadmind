export const GoalPeriods = {
    DAY: "DAY",
    WEEK: "WEEK",
    MONTH: "MONTH",
} as const;

export type GoalPeriod = (typeof GoalPeriods)[keyof typeof GoalPeriods];

export const GoalAchievementTypes = {
    MILESTONE_25: "MILESTONE_25",
    MILESTONE_50: "MILESTONE_50",
    MILESTONE_75: "MILESTONE_75",
    GOAL_COMPLETE: "GOAL_COMPLETE",
    PERSONAL_RECORD: "PERSONAL_RECORD",
    LEADERBOARD_FIRST: "LEADERBOARD_FIRST",
} as const;

export type GoalAchievementType =
    (typeof GoalAchievementTypes)[keyof typeof GoalAchievementTypes];

export interface GoalUser {
    uuid: string;
    email: string;
    full_name: string | null;
}

export interface MessagingGoalProgress {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string;
    period: GoalPeriod;
    target_count: number;
    is_active: boolean;
    current_count: number;
    percent: number;
    period_key: string;
    starts_at: string;
    ends_at: string;
    user: GoalUser;
}

export interface LeaderboardRow {
    user: GoalUser;
    goal_uuid: string;
    period: GoalPeriod;
    target_count: number;
    current_count: number;
    percent: number;
    period_key: string;
    starts_at: string;
    ends_at: string;
    rank: number;
}

export interface GoalAchievement {
    uuid: string;
    organisation_uuid: string;
    user_uuid: string;
    goal_uuid: string;
    type: GoalAchievementType;
    period_key: string;
    payload: {
        count?: number;
        percent?: number;
        target?: number;
        previous_best?: number;
        rank?: number;
    } | null;
    seen_at: string | null;
    created_at: string;
    goal?: {
        uuid: string;
        period: GoalPeriod;
        target_count: number;
    };
}

export interface UpsertMessagingGoalPayload {
    user_uuid: string;
    period: GoalPeriod;
    target_count: number;
}

export interface BulkUpsertMessagingGoalsPayload {
    goals: UpsertMessagingGoalPayload[];
}

export interface UpdateMessagingGoalPayload {
    target_count?: number;
    is_active?: boolean;
}

export interface GoalAchievementEventPayload {
    achievement: {
        uuid: string;
        type: GoalAchievementType;
        period_key: string;
        goal_uuid: string;
        payload: GoalAchievement["payload"];
    };
    progress?: MessagingGoalProgress;
}

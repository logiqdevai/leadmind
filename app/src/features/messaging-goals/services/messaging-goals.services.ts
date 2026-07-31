import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    BulkUpsertMessagingGoalsPayload,
    GoalAchievement,
    GoalPeriod,
    LeaderboardRow,
    MessagingGoalProgress,
    UpdateMessagingGoalPayload,
    UpsertMessagingGoalPayload,
} from "../interfaces/messaging-goals.interfaces";

export const getMyMessagingGoals = async (): Promise<MessagingGoalProgress[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.messaging_goals.me);
        return response.data;
    } catch {
        throw new Error("Failed to load your messaging goals. Please try again.");
    }
};

export const listMessagingGoals = async (): Promise<MessagingGoalProgress[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.messaging_goals.prefix);
        return response.data;
    } catch {
        throw new Error("Failed to load messaging goals. Please try again.");
    }
};

export const getMessagingGoalsLeaderboard = async (
    period: GoalPeriod,
): Promise<LeaderboardRow[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.messaging_goals.leaderboard, {
            params: { period },
        });
        return response.data;
    } catch {
        throw new Error("Failed to load leaderboard. Please try again.");
    }
};

export const listGoalAchievements = async (
    unseen?: boolean,
): Promise<GoalAchievement[]> => {
    try {
        const response = await axiosInstance.get(ApiRoutes.messaging_goals.achievements, {
            params: unseen ? { unseen: "true" } : undefined,
        });
        return response.data;
    } catch {
        throw new Error("Failed to load achievements. Please try again.");
    }
};

export const markGoalAchievementSeen = async (uuid: string): Promise<GoalAchievement> => {
    try {
        const response = await axiosInstance.post(
            ApiRoutes.messaging_goals.achievementSeen(uuid),
        );
        return response.data;
    } catch {
        throw new Error("Failed to mark achievement as seen. Please try again.");
    }
};

export const upsertMessagingGoal = async (
    payload: UpsertMessagingGoalPayload,
): Promise<MessagingGoalProgress> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.messaging_goals.prefix, payload);
        return response.data;
    } catch {
        throw new Error("Failed to save messaging goal. Please try again.");
    }
};

export const bulkUpsertMessagingGoals = async (
    payload: BulkUpsertMessagingGoalsPayload,
): Promise<MessagingGoalProgress[]> => {
    try {
        const response = await axiosInstance.post(ApiRoutes.messaging_goals.bulk, payload);
        return response.data;
    } catch {
        throw new Error("Failed to save messaging goals. Please try again.");
    }
};

export const updateMessagingGoal = async (
    uuid: string,
    payload: UpdateMessagingGoalPayload,
): Promise<MessagingGoalProgress> => {
    try {
        const response = await axiosInstance.patch(
            ApiRoutes.messaging_goals.update(uuid),
            payload,
        );
        return response.data;
    } catch {
        throw new Error("Failed to update messaging goal. Please try again.");
    }
};

export const deactivateMessagingGoal = async (
    uuid: string,
): Promise<MessagingGoalProgress> => {
    try {
        const response = await axiosInstance.delete(ApiRoutes.messaging_goals.remove(uuid));
        return response.data;
    } catch {
        throw new Error("Failed to remove messaging goal. Please try again.");
    }
};

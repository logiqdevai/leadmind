import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type {
    BulkUpsertMessagingGoalsPayload,
    GoalPeriod,
    UpdateMessagingGoalPayload,
    UpsertMessagingGoalPayload,
} from "../interfaces/messaging-goals.interfaces";
import {
    bulkUpsertMessagingGoals,
    deactivateMessagingGoal,
    getMessagingGoalsLeaderboard,
    getMyMessagingGoals,
    listGoalAchievements,
    listMessagingGoals,
    markGoalAchievementSeen,
    updateMessagingGoal,
    upsertMessagingGoal,
} from "../services/messaging-goals.services";

export const messagingGoalsQueryKeys = {
    all: ["messaging-goals"] as const,
    me: ["messaging-goals", "me"] as const,
    list: ["messaging-goals", "list"] as const,
    leaderboard: (period: GoalPeriod) =>
        ["messaging-goals", "leaderboard", period] as const,
    achievements: (unseen?: boolean) =>
        ["messaging-goals", "achievements", unseen ?? false] as const,
};

export function useMyMessagingGoals() {
    return useQuery({
        queryKey: messagingGoalsQueryKeys.me,
        queryFn: getMyMessagingGoals,
        staleTime: 15_000,
    });
}

export function useMessagingGoalsList() {
    return useQuery({
        queryKey: messagingGoalsQueryKeys.list,
        queryFn: listMessagingGoals,
        staleTime: 15_000,
    });
}

export function useMessagingGoalsLeaderboard(period: GoalPeriod) {
    return useQuery({
        queryKey: messagingGoalsQueryKeys.leaderboard(period),
        queryFn: () => getMessagingGoalsLeaderboard(period),
        staleTime: 15_000,
    });
}

export function useGoalAchievements(unseen?: boolean) {
    return useQuery({
        queryKey: messagingGoalsQueryKeys.achievements(unseen),
        queryFn: () => listGoalAchievements(unseen),
        staleTime: 10_000,
    });
}

export function useUpsertMessagingGoal() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpsertMessagingGoalPayload) => upsertMessagingGoal(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });
            toast({ title: "Goal saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save goal",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useBulkUpsertMessagingGoals() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: BulkUpsertMessagingGoalsPayload) =>
            bulkUpsertMessagingGoals(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });
            toast({ title: "Goals saved", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not save goals",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useUpdateMessagingGoal() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: { uuid: string; payload: UpdateMessagingGoalPayload }) =>
            updateMessagingGoal(vars.uuid, vars.payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });
            toast({ title: "Goal updated", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not update goal",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useDeactivateMessagingGoal() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => deactivateMessagingGoal(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });
            toast({ title: "Goal removed", duration: 1500 });
        },
        onError: (error: Error) => {
            toast({
                title: "Could not remove goal",
                description: error.message,
                duration: 3000,
                variant: "error",
            });
        },
    });
}

export function useMarkGoalAchievementSeen() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (uuid: string) => markGoalAchievementSeen(uuid),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });
        },
    });
}

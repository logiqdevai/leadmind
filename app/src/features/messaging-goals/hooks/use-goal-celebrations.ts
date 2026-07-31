import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    messagingGoalsQueryKeys,
    useMarkGoalAchievementSeen,
} from "@/features/messaging-goals/hooks/use-messaging-goals";
import { listGoalAchievements } from "@/features/messaging-goals/services/messaging-goals.services";
import type {
    GoalAchievement,
    GoalAchievementEventPayload,
    GoalAchievementType,
} from "@/features/messaging-goals/interfaces/messaging-goals.interfaces";
import { websocketSubscribe } from "@/features/websocket/services/websocket.service";
import { WEBSOCKET_EVENTS } from "@/features/websocket/interfaces/websocket-events.constants";

export function useGoalCelebrations() {
    const qc = useQueryClient();
    const markSeen = useMarkGoalAchievementSeen();
    const queueRef = useRef<GoalAchievement[]>([]);
    const [current, setCurrent] = useState<GoalAchievement | null>(null);
    const showingRef = useRef(false);

    const enqueue = (items: GoalAchievement[]) => {
        if (items.length === 0) return;
        const seenIds = new Set([
            ...queueRef.current.map((a) => a.uuid),
            ...(current ? [current.uuid] : []),
        ]);
        const fresh = items.filter((a) => !seenIds.has(a.uuid));
        if (fresh.length === 0) return;
        queueRef.current = [...queueRef.current, ...fresh];
        if (!showingRef.current) {
            const next = queueRef.current.shift() ?? null;
            showingRef.current = !!next;
            setCurrent(next);
        }
    };

    const handleClose = () => {
        if (current) {
            markSeen.mutate(current.uuid);
        }
        const next = queueRef.current.shift() ?? null;
        showingRef.current = !!next;
        setCurrent(next);
    };

    useEffect(() => {
        let cancelled = false;
        listGoalAchievements(true)
            .then((achievements) => {
                if (!cancelled) enqueue(achievements);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const invalidate = () =>
            qc.invalidateQueries({ queryKey: messagingGoalsQueryKeys.all });

        const onAchievement = websocketSubscribe<GoalAchievementEventPayload>(
            WEBSOCKET_EVENTS.GOAL.ACHIEVEMENT,
            (payload) => {
                invalidate();
                if (!payload?.achievement?.uuid) return;
                enqueue([
                    {
                        uuid: payload.achievement.uuid,
                        organisation_uuid: "",
                        user_uuid: "",
                        goal_uuid: payload.achievement.goal_uuid,
                        type: payload.achievement.type,
                        period_key: payload.achievement.period_key,
                        payload: payload.achievement.payload,
                        seen_at: null,
                        created_at: new Date().toISOString(),
                    },
                ]);
            },
        );

        const onProgress = websocketSubscribe(
            WEBSOCKET_EVENTS.GOAL.PROGRESS_UPDATED,
            () => invalidate(),
        );

        const onLeaderboard = websocketSubscribe(
            WEBSOCKET_EVENTS.GOAL.LEADERBOARD_UPDATED,
            () => invalidate(),
        );

        return () => {
            onAchievement.unsubscribe();
            onProgress.unsubscribe();
            onLeaderboard.unsubscribe();
        };
    }, [qc]);

    return {
        celebrationType: (current?.type ?? null) as GoalAchievementType | null,
        celebrationOpen: !!current,
        closeCelebration: handleClose,
    };
}

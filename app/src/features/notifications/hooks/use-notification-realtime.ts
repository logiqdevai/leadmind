import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast as herouiToast } from "@heroui/react/toast";
import { showAppNotification } from "@/features/notifications/browser-notifications.service";
import { websocketSubscribe } from "@/features/websocket/services/websocket.service";
import { WEBSOCKET_EVENTS } from "@/features/websocket/interfaces/websocket-events.constants";
import type { AppNotification } from "../interfaces/notification.interface";
import { useNotificationModalStore } from "../stores/notification-modal.store";
import { notificationQueryKeys } from "./use-notifications";

/**
 * Live notifications: refreshes the bell/page lists and shows an in-app popup for each new one.
 * Reminders already raise a browser notification through useReminderNotifications, so only
 * other types get one here.
 */
export function useNotificationRealtime() {
    const qc = useQueryClient();
    const openModal = useNotificationModalStore((s) => s.open);

    useEffect(() => {
        const subscription = websocketSubscribe<AppNotification>(
            WEBSOCKET_EVENTS.NOTIFICATION.CREATED,
            (notification) => {
                qc.invalidateQueries({ queryKey: notificationQueryKeys.all });

                herouiToast(notification.title, {
                    description: notification.body ?? undefined,
                    timeout: 8000,
                    actionProps: { children: "View", onPress: () => openModal(notification) },
                });

                if (notification.type !== "REMINDER_DUE") {
                    showAppNotification({
                        tag: `notification-${notification.uuid}`,
                        title: notification.title,
                        body: notification.body ?? undefined,
                        onClick: () => openModal(notification),
                    });
                }
            },
        );
        return () => subscription.unsubscribe();
    }, [qc, openModal]);
}

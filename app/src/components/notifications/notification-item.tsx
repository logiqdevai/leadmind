import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/features/notifications/interfaces/notification.interface";
import {
    NOTIFICATION_TYPE_META,
    formatNotificationDate,
    formatNotificationTime,
} from "@/features/notifications/utils/notification-display";

interface NotificationItemProps {
    notification: AppNotification;
    onClick: (notification: AppNotification) => void;
    className?: string;
}

/** One notification row, shared by the bell menu and the notifications page. */
export const NotificationItem: FC<NotificationItemProps> = ({ notification, onClick, className }) => {
    const meta = NOTIFICATION_TYPE_META[notification.type];
    const Icon = meta.icon;
    const unread = !notification.read_at;

    return (
        <button
            type="button"
            onClick={() => onClick(notification)}
            className={cn(
                "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-secondary",
                unread && "bg-accent/5",
                className,
            )}
        >
            <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", meta.tone)}>
                <Icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm text-foreground", unread && "font-semibold")}>
                    {notification.title}
                </span>
                {notification.body ? <span className="block truncate text-xs text-muted">{notification.body}</span> : null}
                <span className="mt-0.5 block text-[11px] text-muted">
                    {formatNotificationDate(notification.created_at)} · {formatNotificationTime(notification.created_at)}
                </span>
            </span>
            {unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
        </button>
    );
};

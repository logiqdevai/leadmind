import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { Popover } from "@heroui/react";
import { Bell, CheckCheck } from "lucide-react";
import { Routes } from "@/routes/routes";
import {
    useMarkAllNotificationsRead,
    useNotifications,
    useUnreadNotificationCount,
} from "@/features/notifications/hooks/use-notifications";
import { useNotificationModalStore } from "@/features/notifications/stores/notification-modal.store";
import type { AppNotification } from "@/features/notifications/interfaces/notification.interface";
import { NotificationItem } from "./notification-item";

/** Navbar bell: unread badge plus a menu of the latest unread notifications. */
export const NotificationBell: FC = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const openModal = useNotificationModalStore((s) => s.open);
    const { data: unread } = useUnreadNotificationCount();
    const { data, isLoading } = useNotifications({ unread_only: true, limit: 8 }, { enabled: isOpen });
    const markAllRead = useMarkAllNotificationsRead();

    const count = unread?.count ?? 0;
    const items = data?.data ?? [];

    const handleSelect = (notification: AppNotification) => {
        setIsOpen(false);
        openModal(notification);
    };

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger
                aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
                className="relative cursor-pointer rounded-lg p-1.5 text-muted outline-none transition-colors duration-200 hover:bg-surface-secondary hover:text-foreground"
            >
                <Bell className="h-4 w-4" />
                {count > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                        {count > 99 ? "99+" : count}
                    </span>
                ) : null}
            </Popover.Trigger>

            <Popover.Content
                placement="bottom end"
                className="w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-0"
            >
                <Popover.Dialog className="outline-none">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                        <p className="text-sm font-semibold text-foreground">Notifications</p>
                        <button
                            type="button"
                            disabled={count === 0 || markAllRead.isPending}
                            onClick={() => markAllRead.mutate()}
                            className="flex items-center gap-1 text-xs text-accent transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-40"
                        >
                            <CheckCheck className="size-3.5" />
                            Mark all read
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto p-1.5">
                        {isLoading ? (
                            <p className="px-3 py-6 text-center text-sm text-muted">Loading…</p>
                        ) : items.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-muted">You're all caught up.</p>
                        ) : (
                            items.map((n) => <NotificationItem key={n.uuid} notification={n} onClick={handleSelect} />)
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            navigate(Routes.dashboard.notifications);
                        }}
                        className="w-full border-t border-border px-3 py-2 text-center text-xs font-medium text-accent transition-colors hover:bg-surface-secondary"
                    >
                        View all notifications
                    </button>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
};

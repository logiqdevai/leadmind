import { useSearchParams } from "react-router-dom";
import { Button, ListBox, Select } from "@heroui/react";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationPermissionBanner } from "@/components/ui/notification-permission-banner";
import { NotificationItem } from "@/components/notifications/notification-item";
import { TablePagination } from "@/components/ui/table-pagination";
import {
    useDeleteNotification,
    useMarkAllNotificationsRead,
    useNotifications,
    useUnreadNotificationCount,
} from "@/features/notifications/hooks/use-notifications";
import { useNotificationModalStore } from "@/features/notifications/stores/notification-modal.store";
import { NOTIFICATION_FILTER_OPTIONS } from "@/features/notifications/utils/notification-display";
import type { NotificationType } from "@/features/notifications/interfaces/notification.interface";

const PAGE_SIZE = 20;

const READ_FILTERS = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
] as const;

export default function NotificationsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const openModal = useNotificationModalStore((s) => s.open);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const unreadOnly = searchParams.get("filter") === "unread";
    const typeParam = searchParams.get("type") ?? "";

    const updateParams = (next: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
    };

    const { data, isLoading, isFetching } = useNotifications({
        page,
        limit: PAGE_SIZE,
        unread_only: unreadOnly || undefined,
        type: (typeParam as NotificationType) || undefined,
    });
    const { data: unread } = useUnreadNotificationCount();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteNotification = useDeleteNotification();

    const notifications = data?.data ?? [];
    const unreadCount = unread?.count ?? 0;

    return (
        <div className="flex flex-col gap-5">
            <NotificationPermissionBanner />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Bell className="size-5 text-muted" />
                    <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
                    {unreadCount > 0 ? (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                            {unreadCount} unread
                        </span>
                    ) : null}
                </div>
                <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={unreadCount === 0 || markAllRead.isPending}
                    onPress={() => markAllRead.mutate()}
                >
                    <CheckCheck className="size-3.5" />
                    Mark all as read
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                    {READ_FILTERS.map((f) => {
                        const active = (f.id === "unread") === unreadOnly;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => updateParams({ filter: f.id === "unread" ? "unread" : null, page: null })}
                                className={cn(
                                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                    active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground",
                                )}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>

                <Select
                    aria-label="Filter by type"
                    placeholder="All types"
                    value={typeParam}
                    onChange={(v) => updateParams({ type: (v as string) || null, page: null })}
                    className="w-44"
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {NOTIFICATION_FILTER_OPTIONS.map((opt) => (
                                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                    {opt.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            </div>

            <div className="rounded-xl border border-border bg-surface p-1.5">
                {isLoading ? (
                    <p className="px-4 py-12 text-center text-sm text-muted">Loading notifications…</p>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                        <BellOff className="size-6 text-muted" />
                        <p className="text-sm text-muted">
                            {unreadOnly ? "No unread notifications." : "No notifications yet."}
                        </p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div key={n.uuid} className="group flex items-center gap-1">
                            <NotificationItem notification={n} onClick={openModal} className="flex-1" />
                            <button
                                type="button"
                                aria-label="Delete notification"
                                disabled={deleteNotification.isPending}
                                onClick={() => deleteNotification.mutate(n.uuid)}
                                className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {(data?.totalPages ?? 1) > 1 && (
                <TablePagination
                    page={page}
                    totalPages={data?.totalPages ?? 1}
                    total={data?.total ?? 0}
                    pageSize={PAGE_SIZE}
                    onPageChange={(p) => updateParams({ page: String(p) })}
                    isFetching={isFetching}
                    label="notifications"
                />
            )}
        </div>
    );
}

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Input, ListBox, Select } from "@heroui/react";
import { Bell, Plus, Search } from "lucide-react";
import { ReminderFormModal } from "@/components/reminders";
import { NotificationPermissionBanner } from "@/components/ui/notification-permission-banner";
import { useReminders, useReminderStats } from "@/features/reminders/hooks/use-reminders";
import { useReminderNotifications } from "@/features/reminders/hooks/use-reminder-notifications";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthStore } from "@/stores/auth";
import type { ReminderStatus } from "@/features/reminders/interfaces/reminder.interface";
import { ReminderStatsCards } from "./components/reminder-stats-cards";
import { RemindersTable } from "./components/reminders-table";
import { MobileListFilters } from "@/components/ui/mobile-list-filters";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
    { id: "", label: "All statuses" },
    { id: "PENDING", label: "Pending" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];

const RANGE_OPTIONS = [
    { id: "", label: "All dates" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "overdue", label: "Overdue" },
];

const ASSIGNED_ME = "me";

const ASSIGNED_OPTIONS = [
    { id: "", label: "All reminders" },
    { id: ASSIGNED_ME, label: "Assigned to me" },
];

export default function RemindersPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [createOpen, setCreateOpen] = useState(false);

    useReminderNotifications();

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = searchParams.get("search") ?? "";
    const statusParam = searchParams.get("status") ?? "";
    const rangeParam = searchParams.get("range") ?? "";
    const assignedParam = searchParams.get("assigned") ?? "";
    const currentUserUuid = useAuthStore((s) => s.user_uuid);

    const updateParams = (next: Record<string, string | undefined | null>) => {
        const params = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") params.delete(k);
            else params.set(k, v);
        }
        setSearchParams(params, { replace: true });
    };

    const debouncedSearch = useDebouncedValue(search, 300);

    const status = (statusParam as ReminderStatus) || undefined;
    const range = (rangeParam as "today" | "week" | "month" | "all" | "overdue") || undefined;

    const { data: remindersPage, isLoading, isFetching } = useReminders({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status,
        range,
        // "Assigned to me" also includes reminders that go to everyone.
        for_user_uuid: assignedParam === ASSIGNED_ME && currentUserUuid ? currentUserUuid : undefined,
    });

    const { data: stats, isLoading: statsLoading } = useReminderStats();

    const reminders = remindersPage?.data ?? [];
    const total = remindersPage?.total ?? 0;
    const totalPages = remindersPage?.totalPages ?? 1;

    return (
        <div className="flex flex-col gap-5">
            <NotificationPermissionBanner />

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Bell className="size-5 text-muted" />
                    <h1 className="text-xl font-semibold text-foreground">Reminders</h1>
                </div>
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setCreateOpen(true)}
                >
                    <Plus className="size-3.5" />
                    New Reminder
                </Button>
            </div>

            <ReminderStatsCards stats={stats} isLoading={statsLoading} />

            <MobileListFilters
                search={
                    <div className="relative">
                        <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                            className="pl-9"
                            placeholder="Search reminders…"
                            value={search}
                            onChange={(e) =>
                                updateParams({ search: e.target.value || null, page: "1" })
                            }
                        />
                    </div>
                }
                extras={
                    <>
                <Select
                    aria-label="Filter by status"
                    placeholder="All statuses"
                    value={statusParam}
                    onChange={(v) => updateParams({ status: (v as string) || null, page: "1" })}
                    className="w-40"
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {STATUS_OPTIONS.map((opt) => (
                                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                    {opt.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>

                <Select
                    aria-label="Filter by date range"
                    placeholder="All dates"
                    value={rangeParam}
                    onChange={(v) => updateParams({ range: (v as string) || null, page: "1" })}
                    className="w-40"
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {RANGE_OPTIONS.map((opt) => (
                                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                    {opt.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>

                <Select
                    aria-label="Filter by assignee"
                    placeholder="All reminders"
                    value={assignedParam}
                    onChange={(v) => updateParams({ assigned: (v as string) || null, page: "1" })}
                    className="w-44"
                >
                    <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {ASSIGNED_OPTIONS.map((opt) => (
                                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                    {opt.label}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
                    </>
                }
            />

            <RemindersTable
                reminders={reminders}
                isLoading={isLoading}
                isFetching={isFetching}
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                totalPages={totalPages}
                onPageChange={(p) => updateParams({ page: String(p) })}
            />

            <ReminderFormModal
                isOpen={createOpen}
                onOpenChange={setCreateOpen}
            />
        </div>
    );
}

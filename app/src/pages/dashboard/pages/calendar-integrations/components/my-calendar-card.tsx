import { useMemo, useState, type FC } from "react";
import { Button, Spinner } from "@heroui/react";
import { AlertTriangle, CalendarDays, Unplug } from "lucide-react";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchSelect } from "@/components/ui/search-select";
import {
    useConnectGoogleCalendar,
    useDisconnectCalendar,
    useGoogleCalendars,
    useUpdateCalendarConnection,
} from "@/features/bookings/hooks/use-availability";
import {
    CalendarConnectionStatuses,
    type CalendarConnection,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { SettingSwitch, SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import { ConnectionStatusChip } from "./connection-status-chip";

interface MyCalendarCardProps {
    connection: CalendarConnection | null;
    configured: boolean;
}

export const MyCalendarCard: FC<MyCalendarCardProps> = ({ connection, configured }) => {
    const connect = useConnectGoogleCalendar();
    const update = useUpdateCalendarConnection();
    const disconnect = useDisconnectCalendar();
    const [confirmOpen, setConfirmOpen] = useState(false);

    const status = connection?.status ?? null;
    const isActive = status === CalendarConnectionStatuses.ACTIVE;
    const isConnected = !!connection && status !== CalendarConnectionStatuses.DISCONNECTED;
    const needsReconnect =
        status === CalendarConnectionStatuses.EXPIRED ||
        status === CalendarConnectionStatuses.FAILED ||
        status === CalendarConnectionStatuses.INITIATED;

    const calendars = useGoogleCalendars(isActive ? connection?.uuid : null);
    const calendarOptions = useMemo(
        () =>
            (calendars.data ?? []).map((c) => ({
                id: c.id,
                label: `${c.summary}${c.primary ? " (primary)" : ""}`,
            })),
        [calendars.data],
    );

    const connectLabel = !isConnected ? "Connect Google Calendar" : needsReconnect ? "Reconnect" : "Reconnect account";

    return (
        <SettingsSection title="Your Google Calendar">
            <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <CalendarDays className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">Google Calendar</p>
                        <ConnectionStatusChip status={isConnected ? status : null} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                        {isConnected && connection?.account_email
                            ? connection.account_email
                            : "Connect your own Google account. Only you can connect it."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ActionButtonWithPending
                        size="sm"
                        variant={!isActive || needsReconnect ? "primary" : "secondary"}
                        isPending={connect.isPending}
                        isDisabled={!configured || connect.isPending}
                        onPress={() => connect.mutate()}
                    >
                        {connectLabel}
                    </ActionButtonWithPending>
                    {isConnected && connection ? (
                        <Button size="sm" variant="tertiary" className="text-danger" onPress={() => setConfirmOpen(true)}>
                            <Unplug className="size-4" />
                            Disconnect
                        </Button>
                    ) : null}
                </div>
            </div>

            {isConnected && connection?.last_error ? (
                <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{connection.last_error}</span>
                </div>
            ) : null}

            {isActive && connection ? (
                <div className="space-y-4">
                    <div className="flex flex-col gap-1.5 sm:max-w-md">
                        <span className="text-sm font-medium text-foreground">Calendar for bookings</span>
                        {calendars.isLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted">
                                <Spinner size="sm" /> Loading your calendars…
                            </div>
                        ) : calendars.isError ? (
                            <p className="text-xs text-danger">
                                {calendars.error instanceof Error ? calendars.error.message : "Could not load your calendars."}
                            </p>
                        ) : (
                            <SearchSelect
                                aria-label="Calendar for bookings"
                                options={
                                    calendarOptions.some((o) => o.id === connection.calendar_id)
                                        ? calendarOptions
                                        : [{ id: connection.calendar_id, label: connection.calendar_name ?? connection.calendar_id }, ...calendarOptions]
                                }
                                value={connection.calendar_id}
                                onChange={(calendar_id) => {
                                    if (calendar_id && calendar_id !== connection.calendar_id) {
                                        update.mutate({ uuid: connection.uuid, payload: { calendar_id } });
                                    }
                                }}
                                searchPlaceholder="Search calendars…"
                                isDisabled={update.isPending}
                                fullWidth
                            />
                        )}
                        <p className="text-xs text-muted">New bookings assigned to you are added here.</p>
                    </div>
                    <SettingSwitch
                        label="Check for conflicts"
                        description="Busy events in this Google Calendar block those times on every booking page you're part of."
                        isSelected={connection.check_conflicts}
                        onChange={(check_conflicts) => update.mutate({ uuid: connection.uuid, payload: { check_conflicts } })}
                        isDisabled={update.isPending}
                    />
                </div>
            ) : null}

            {connection ? (
                <ConfirmDialog
                    isOpen={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    title="Disconnect Google Calendar?"
                    description="New bookings won't be added to your Google Calendar and its events won't block booking times anymore. Existing bookings are kept, in the app and in Google."
                    confirmLabel="Disconnect"
                    variant="danger"
                    isPending={disconnect.isPending}
                    onConfirm={async () => {
                        await disconnect.mutateAsync(connection.uuid);
                        setConfirmOpen(false);
                    }}
                />
            ) : null}
        </SettingsSection>
    );
};

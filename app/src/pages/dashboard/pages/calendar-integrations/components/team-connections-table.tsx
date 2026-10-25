import { useMemo, useState, type FC } from "react";
import { Button, Table } from "@heroui/react";
import { Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDisconnectCalendar } from "@/features/bookings/hooks/use-availability";
import {
    CalendarConnectionStatuses,
    type CalendarConnection,
} from "@/features/bookings/interfaces/bookings.interfaces";
import type { OrganisationMember } from "@/features/organisations/interfaces/organisation.interfaces";
import { DashboardAvatar } from "@/pages/dashboard/components/dashboard-shared";
import { SettingsSection } from "@/pages/dashboard/pages/booking-pages/pages/detail/components/form-fields";
import { ConnectionStatusChip } from "./connection-status-chip";

interface Row {
    userUuid: string;
    name: string;
    email: string;
    connection: CalendarConnection | null;
}

interface TeamConnectionsTableProps {
    members: OrganisationMember[];
    connections: CalendarConnection[];
    currentUserUuid: string;
}

export const TeamConnectionsTable: FC<TeamConnectionsTableProps> = ({ members, connections, currentUserUuid }) => {
    const disconnect = useDisconnectCalendar();
    const [toDisconnect, setToDisconnect] = useState<Row | null>(null);

    const rows = useMemo<Row[]>(() => {
        const byUser = new Map(connections.map((c) => [c.user_uuid, c]));
        const list: Row[] = members.map((m) => ({
            userUuid: m.user_uuid,
            name: m.full_name?.trim() || m.email,
            email: m.email,
            connection: byUser.get(m.user_uuid) ?? null,
        }));
        // Connections of people no longer listed as members (still shown so they can be cleaned up).
        for (const c of connections) {
            if (!members.some((m) => m.user_uuid === c.user_uuid)) {
                list.push({ userUuid: c.user_uuid, name: c.user.full_name?.trim() || c.user.email, email: c.user.email, connection: c });
            }
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [members, connections]);

    const connectedCount = rows.filter((r) => r.connection?.status === CalendarConnectionStatuses.ACTIVE).length;

    return (
        <SettingsSection
            title="Team"
            description={`${connectedCount} of ${rows.length} member${rows.length === 1 ? "" : "s"} connected. Members connect their own account from this page.`}
        >
            <Table>
                <Table.ScrollContainer className="w-full max-w-full overflow-x-auto">
                    <Table.Content aria-label="Team calendar connections" className="min-w-[720px]">
                        <Table.Header>
                            <Table.Column id="member" isRowHeader>
                                Member
                            </Table.Column>
                            <Table.Column id="status">Status</Table.Column>
                            <Table.Column id="account">Google account</Table.Column>
                            <Table.Column id="calendar">Calendar</Table.Column>
                            <Table.Column id="actions">
                                <span className="sr-only">Actions</span>
                            </Table.Column>
                        </Table.Header>
                        <Table.Body>
                            {rows.map((row) => {
                                const c = row.connection;
                                const connected = !!c && c.status !== CalendarConnectionStatuses.DISCONNECTED;
                                return (
                                    <Table.Row key={row.userUuid} id={row.userUuid}>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2.5">
                                                <DashboardAvatar name={row.name} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm text-foreground">
                                                        {row.name}
                                                        {row.userUuid === currentUserUuid ? <span className="text-muted"> (you)</span> : null}
                                                    </p>
                                                    {row.name !== row.email ? <p className="truncate text-xs text-muted">{row.email}</p> : null}
                                                </div>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="space-y-1">
                                                <ConnectionStatusChip status={connected ? c.status : null} />
                                                {connected && c.last_error ? (
                                                    <p className="max-w-56 truncate text-[11px] text-danger" title={c.last_error}>
                                                        {c.last_error}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="text-xs text-muted">{connected ? (c.account_email ?? "Unknown") : "None"}</span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <span className="text-xs text-muted">
                                                {connected ? (c.calendar_name ?? c.calendar_id) : "None"}
                                                {connected && !c.check_conflicts ? " · conflicts off" : ""}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {connected ? (
                                                <div className="flex justify-end">
                                                    <Button size="sm" variant="tertiary" aria-label={`Disconnect ${row.name}`} onPress={() => setToDisconnect(row)}>
                                                        <Unplug className="size-4 text-danger" />
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>

            <ConfirmDialog
                isOpen={!!toDisconnect}
                onOpenChange={(open) => {
                    if (!open) setToDisconnect(null);
                }}
                title={`Disconnect ${toDisconnect?.name ?? "this member"}'s Google Calendar?`}
                description="Their new bookings won't be added to Google and their Google events stop blocking times. Existing bookings are kept. Only they can reconnect."
                confirmLabel="Disconnect"
                variant="danger"
                isPending={disconnect.isPending}
                onConfirm={async () => {
                    if (!toDisconnect?.connection) return;
                    await disconnect.mutateAsync(toDisconnect.connection.uuid);
                    setToDisconnect(null);
                }}
            />
        </SettingsSection>
    );
};

import { useEffect, type FC, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Modal } from "@heroui/react";
import { cn } from "@/lib/utils";
import { Routes } from "@/routes/routes";
import { useBookingTimezone } from "@/components/bookings/hooks/use-booking-context";
import { useMarkNotificationRead } from "@/features/notifications/hooks/use-notifications";
import { useNotificationModalStore } from "@/features/notifications/stores/notification-modal.store";
import {
    NOTIFICATION_TYPE_META,
    formatNotificationDateTime,
} from "@/features/notifications/utils/notification-display";
import type { AppNotification } from "@/features/notifications/interfaces/notification.interface";

const DetailRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-1.5 text-sm">
        <dt className="text-muted">{label}</dt>
        <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
);

function NotificationDetails({ notification, timezone }: { notification: AppNotification; timezone: string }) {
    const data = notification.data ?? {};

    if (notification.entity_type === "booking") {
        const contact = [data.invitee_name, data.invitee_email].filter(Boolean).join(" · ");
        return (
            <dl className="divide-y divide-border">
                {data.start_at ? <DetailRow label="When">{formatNotificationDateTime(data.start_at, timezone)}</DetailRow> : null}
                {data.duration_minutes ? <DetailRow label="Duration">{data.duration_minutes} min</DetailRow> : null}
                {contact ? <DetailRow label="Invitee">{contact}</DetailRow> : null}
                {data.invitee_phone ? <DetailRow label="Phone">{data.invitee_phone}</DetailRow> : null}
                {data.booking_status ? (
                    <DetailRow label="Status">{data.booking_status.replace("_", " ").toLowerCase()}</DetailRow>
                ) : null}
                {data.location_value ? <DetailRow label="Location">{data.location_value}</DetailRow> : null}
                {data.meeting_url ? (
                    <DetailRow label="Meeting link">
                        <a href={data.meeting_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            {data.meeting_url}
                        </a>
                    </DetailRow>
                ) : null}
                {data.invitee_notes ? <DetailRow label="Notes">{data.invitee_notes}</DetailRow> : null}
            </dl>
        );
    }

    const contact = data.contact_company ?? data.contact_name;
    return (
        <dl className="divide-y divide-border">
            {data.remind_at ? <DetailRow label="Due">{formatNotificationDateTime(data.remind_at)}</DetailRow> : null}
            {contact ? <DetailRow label="Contact">{contact}</DetailRow> : null}
            {data.contact_email ? <DetailRow label="Email">{data.contact_email}</DetailRow> : null}
            {data.reminder_type ? <DetailRow label="Type">{data.reminder_type.replace("_", " ").toLowerCase()}</DetailRow> : null}
        </dl>
    );
}

/** Mounted once in the dashboard layout; opened through useNotificationModalStore. Opening marks it read. */
export const NotificationDetailModal: FC = () => {
    const navigate = useNavigate();
    const timezone = useBookingTimezone();
    const notification = useNotificationModalStore((s) => s.notification);
    const close = useNotificationModalStore((s) => s.close);
    const markRead = useMarkNotificationRead();

    const uuid = notification?.uuid;
    const isUnread = !!notification && !notification.read_at;
    useEffect(() => {
        if (uuid && isUnread) markRead.mutate(uuid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uuid]);

    const meta = notification ? NOTIFICATION_TYPE_META[notification.type] : null;
    const Icon = meta?.icon;

    const openRelated = () => {
        if (!notification?.entity_uuid) return;
        if (notification.entity_type === "booking") {
            navigate(`${Routes.dashboard.calendar}?booking=${notification.entity_uuid}`);
        } else if (notification.data?.contact_uuid) {
            navigate(Routes.dashboard.contacts_detail.replace(":uuid", notification.data.contact_uuid));
        } else {
            navigate(Routes.dashboard.reminders);
        }
        close();
    };

    return (
        <Modal.Backdrop isOpen={!!notification} onOpenChange={(open) => !open && close()}>
            <Modal.Container>
                <Modal.Dialog className="sm:max-w-md">
                    <Modal.CloseTrigger />
                    {notification && meta && Icon ? (
                        <>
                            <Modal.Header>
                                <div className="flex items-start gap-3">
                                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", meta.tone)}>
                                        <Icon className="size-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted">{meta.label}</p>
                                        <Modal.Heading className="break-words">{notification.title}</Modal.Heading>
                                        <p className="text-xs text-muted">{formatNotificationDateTime(notification.created_at)}</p>
                                    </div>
                                </div>
                            </Modal.Header>
                            <Modal.Body className="space-y-3">
                                {notification.body ? <p className="whitespace-pre-wrap text-sm text-foreground">{notification.body}</p> : null}
                                <NotificationDetails notification={notification} timezone={timezone} />
                            </Modal.Body>
                            <Modal.Footer>
                                <Button variant="secondary" onPress={close}>
                                    Close
                                </Button>
                                <Button onPress={openRelated}>
                                    {notification.entity_type === "booking" ? "Open booking" : "Open contact"}
                                </Button>
                            </Modal.Footer>
                        </>
                    ) : null}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    );
};

import { useState, type FC } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Chip } from "@heroui/react";
import { CalendarClock, XCircle } from "lucide-react";
import {
    BookingStatuses,
    type PublicManagedBooking,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { useManagedBooking } from "@/features/bookings/hooks/use-public-booking";
import {
    BOOKING_STATUS_CHIP_COLORS,
    BOOKING_STATUS_LABELS,
} from "@/features/bookings/constants/booking-labels";
import { formatDateTime, formatMinutesSpan } from "@/features/bookings/utils/booking-time";
import { Routes } from "@/routes/routes";
import { isNotFoundError } from "@/pages/booking/utils/booking-errors";
import { BookingBrandScope } from "@/pages/booking/components/booking-brand-scope";
import { BookingCard } from "@/pages/booking/components/booking-card";
import { BookingPageSkeleton } from "@/pages/booking/components/booking-page-skeleton";
import { BookingStateCard } from "@/pages/booking/components/booking-state-card";
import { BookingSummaryList } from "@/pages/booking/components/booking-summary-list";
import { ManageCancelPanel } from "@/pages/booking/pages/manage/components/manage-cancel-panel";
import { ManageReschedulePanel } from "@/pages/booking/pages/manage/components/manage-reschedule-panel";

const ManageModes = {
    CANCEL: "cancel",
    RESCHEDULE: "reschedule",
} as const;
type ManageMode = (typeof ManageModes)[keyof typeof ManageModes];

const parseMode = (value: string | null): ManageMode | null =>
    value === ManageModes.CANCEL || value === ManageModes.RESCHEDULE ? value : null;

interface ManageBookingViewProps {
    token: string;
    data: PublicManagedBooking;
    initialMode: ManageMode | null;
}

const ManageBookingView: FC<ManageBookingViewProps> = ({ token, data, initialMode }) => {
    const { booking, policy } = data;
    const [mode, setMode] = useState<ManageMode | null>(initialMode);
    const [success, setSuccess] = useState<string | null>(null);

    // Policy wins over the ?action= hint: only open a mode the booking actually allows.
    const activeMode =
        (mode === ManageModes.CANCEL && policy.can_cancel) || (mode === ManageModes.RESCHEDULE && policy.can_reschedule)
            ? mode
            : null;
    const isCancelled = booking.status === BookingStatuses.CANCELLED;
    const canAct = policy.can_cancel || policy.can_reschedule;

    return (
        <BookingBrandScope color={booking.primary_color}>
            <BookingCard className="mx-auto max-w-3xl">
                <div className="flex flex-col gap-6">
                    <header className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                {booking.logo_url ? (
                                    <img
                                        src={booking.logo_url}
                                        alt={booking.organisation_name ? `${booking.organisation_name} logo` : "Logo"}
                                        className="size-10 shrink-0 rounded-xl object-contain"
                                    />
                                ) : null}
                                {booking.organisation_name ? (
                                    <span className="truncate text-sm font-semibold text-muted">
                                        {booking.organisation_name}
                                    </span>
                                ) : null}
                            </div>
                            <Chip size="sm" variant="soft" color={BOOKING_STATUS_CHIP_COLORS[booking.status]}>
                                <Chip.Label>{BOOKING_STATUS_LABELS[booking.status]}</Chip.Label>
                            </Chip>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">{booking.title}</h1>
                            <p className="text-sm text-muted">Booked for {booking.invitee_name}</p>
                        </div>
                    </header>

                    {success ? (
                        <Alert status="success">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{success}</Alert.Title>
                            </Alert.Content>
                        </Alert>
                    ) : null}

                    <section className="rounded-xl bg-surface-secondary/50 p-4">
                        <BookingSummaryList data={booking} />
                    </section>

                    {activeMode === ManageModes.CANCEL ? (
                        <ManageCancelPanel
                            token={token}
                            reasonRequired={policy.require_cancellation_reason}
                            onClose={() => setMode(null)}
                            onDone={() => {
                                setMode(null);
                                setSuccess("Your booking was cancelled.");
                            }}
                        />
                    ) : null}

                    {activeMode === ManageModes.RESCHEDULE ? (
                        <ManageReschedulePanel
                            token={token}
                            booking={booking}
                            policy={policy}
                            onClose={() => setMode(null)}
                            onDone={(start, tz) => {
                                setMode(null);
                                setSuccess(`Your booking was moved to ${formatDateTime(start, tz)}.`);
                            }}
                        />
                    ) : null}

                    {!activeMode ? (
                        isCancelled ? (
                            <p className="text-sm text-muted">This booking is cancelled. Nothing else to do here.</p>
                        ) : canAct ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    {policy.can_reschedule ? (
                                        <Button
                                            variant="primary"
                                            onPress={() => {
                                                setSuccess(null);
                                                setMode(ManageModes.RESCHEDULE);
                                            }}
                                        >
                                            <CalendarClock className="size-4" aria-hidden />
                                            Reschedule
                                        </Button>
                                    ) : null}
                                    {policy.can_cancel ? (
                                        <Button
                                            variant="danger-soft"
                                            onPress={() => {
                                                setSuccess(null);
                                                setMode(ManageModes.CANCEL);
                                            }}
                                        >
                                            <XCircle className="size-4" aria-hidden />
                                            Cancel booking
                                        </Button>
                                    ) : null}
                                </div>
                                <PolicyHints
                                    cancelMinutes={policy.can_cancel ? policy.cancellation_deadline_minutes : 0}
                                    rescheduleMinutes={policy.can_reschedule ? policy.reschedule_deadline_minutes : 0}
                                />
                            </div>
                        ) : policy.reason ? (
                            <Alert status="default">
                                <Alert.Indicator />
                                <Alert.Content>
                                    <Alert.Title>Changes are not possible</Alert.Title>
                                    <Alert.Description>{policy.reason}</Alert.Description>
                                </Alert.Content>
                            </Alert>
                        ) : null
                    ) : null}
                </div>
            </BookingCard>
        </BookingBrandScope>
    );
};

const PolicyHints: FC<{ cancelMinutes: number; rescheduleMinutes: number }> = ({ cancelMinutes, rescheduleMinutes }) => {
    const hints: string[] = [];
    if (rescheduleMinutes > 0) hints.push(`Rescheduling is possible up to ${formatMinutesSpan(rescheduleMinutes)} before the start.`);
    if (cancelMinutes > 0) hints.push(`Cancelling is possible up to ${formatMinutesSpan(cancelMinutes)} before the start.`);
    if (hints.length === 0) return null;
    return (
        <ul className="flex flex-col gap-1 text-xs text-muted">
            {hints.map((hint) => (
                <li key={hint}>{hint}</li>
            ))}
        </ul>
    );
};

const ManageBookingPage: FC = () => {
    const { token = "" } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const initialMode = parseMode(searchParams.get(Routes.booking.manage_action_query));
    const { data, isLoading, isError, error, refetch } = useManagedBooking(token);

    if (isLoading) return <BookingPageSkeleton />;

    if (!token || (isError && isNotFoundError(error))) {
        return (
            <BookingStateCard
                title="This booking could not be found"
                description="The link may be incomplete or no longer valid. Please use the link from your most recent confirmation email."
            />
        );
    }

    if (isError || !data) {
        return (
            <BookingStateCard
                title="Something went wrong"
                description="We could not load your booking. Please check your connection and try again."
                action={
                    <Button variant="secondary" onPress={() => void refetch()}>
                        Try again
                    </Button>
                }
            />
        );
    }

    return <ManageBookingView token={token} data={data} initialMode={initialMode} />;
};

export default ManageBookingPage;

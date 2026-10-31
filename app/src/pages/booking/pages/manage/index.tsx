import { useEffect, useRef, useState, type FC } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Alert, Button, Chip } from "@heroui/react";
import { CalendarClock, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    BookingStatuses,
    type PublicManagedBooking,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { useConfirmManagedAttendance, useManagedBooking } from "@/features/bookings/hooks/use-public-booking";
import {
    BOOKING_STATUS_CHIP_COLORS,
} from "@/features/bookings/constants/booking-labels";
import { formatDateTime } from "@/features/bookings/utils/booking-time";
import { formatMinutesSpanLocalized } from "@/pages/booking/utils/booking-format";
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
    /** Progress of the attendance confirmation opened from the email's button. */
    confirmation: { isPending: boolean; isError: boolean };
}

const ManageBookingView: FC<ManageBookingViewProps> = ({ token, data, initialMode, confirmation }) => {
    const { t } = useTranslation();
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
                                        alt={booking.brand_name ? t("booking.header.logoAlt", { brand: booking.brand_name }) : t("booking.manage.logo")}
                                        className="size-10 shrink-0 rounded-xl object-contain"
                                    />
                                ) : null}
                                {booking.brand_name ? (
                                    <span className="truncate text-sm font-semibold text-muted">
                                        {booking.brand_name}
                                    </span>
                                ) : null}
                            </div>
                            <Chip size="sm" variant="soft" color={BOOKING_STATUS_CHIP_COLORS[booking.status]}>
                                <Chip.Label>{t(`booking.status.${booking.status}`)}</Chip.Label>
                            </Chip>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-semibold leading-tight text-foreground">{booking.title}</h1>
                            <p className="text-sm text-muted">{t("booking.manage.bookedFor", { name: booking.invitee_name })}</p>
                        </div>
                    </header>

                    {booking.attendance_confirmed_at && !isCancelled ? (
                        <Alert status="success">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{t("booking.manage.attendanceConfirmed")}</Alert.Title>
                            </Alert.Content>
                        </Alert>
                    ) : confirmation.isPending ? (
                        <Alert status="default">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{t("booking.manage.confirming")}</Alert.Title>
                            </Alert.Content>
                        </Alert>
                    ) : confirmation.isError ? (
                        <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{t("booking.manage.confirmFailed")}</Alert.Title>
                            </Alert.Content>
                        </Alert>
                    ) : null}

                    {success ? (
                        <Alert status="success">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{success}</Alert.Title>
                            </Alert.Content>
                        </Alert>
                    ) : null}

                    <section className="rounded-xl bg-surface-secondary/80 p-4">
                        <BookingSummaryList data={booking} />
                    </section>

                    {activeMode === ManageModes.CANCEL ? (
                        <ManageCancelPanel
                            token={token}
                            reasonRequired={policy.require_cancellation_reason}
                            onClose={() => setMode(null)}
                            onDone={() => {
                                setMode(null);
                                setSuccess(t("booking.manage.cancelled"));
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
                                setSuccess(t("booking.manage.movedTo", { when: formatDateTime(start, tz) }));
                            }}
                        />
                    ) : null}

                    {!activeMode ? (
                        isCancelled ? (
                            <p className="text-sm text-muted">{t("booking.manage.isCancelled")}</p>
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
                                            {t("booking.manage.reschedule")}
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
                                            {t("booking.manage.cancel")}
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
                                    <Alert.Title>{t("booking.manage.changesNotPossible")}</Alert.Title>
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
    const { t } = useTranslation();
    const hints: string[] = [];
    if (rescheduleMinutes > 0) hints.push(t("booking.manage.rescheduleHint", { span: formatMinutesSpanLocalized(rescheduleMinutes) }));
    if (cancelMinutes > 0) hints.push(t("booking.manage.cancelHint", { span: formatMinutesSpanLocalized(cancelMinutes) }));
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
    const { t } = useTranslation();
    const { token = "" } = useParams<{ token: string }>();
    const [searchParams] = useSearchParams();
    const initialMode = parseMode(searchParams.get(Routes.booking.manage_action_query));
    const { data, isLoading, isError, error, refetch } = useManagedBooking(token);
    const confirmAttendance = useConfirmManagedAttendance(token);
    const confirmRequested = useRef(false);
    const wantsConfirmation = searchParams.get(Routes.booking.manage_action_query) === "confirm";

    // The email button lands here; record the confirmation once the booking has loaded. Repeat visits are harmless
    // because the API ignores a booking that is already confirmed (or doesn't ask for confirmation).
    useEffect(() => {
        if (!wantsConfirmation || !data || confirmRequested.current) return;
        confirmRequested.current = true;
        const { attendance_confirmation_required, attendance_confirmed_at } = data.booking;
        if (attendance_confirmation_required && !attendance_confirmed_at) confirmAttendance.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantsConfirmation, data]);

    if (isLoading) return <BookingPageSkeleton />;

    if (!token || (isError && isNotFoundError(error))) {
        return (
            <BookingStateCard
                title={t("booking.manage.notFoundTitle")}
                description={t("booking.manage.notFoundDescription")}
            />
        );
    }

    if (isError || !data) {
        return (
            <BookingStateCard
                title={t("booking.loadFailed.title")}
                description={t("booking.manage.loadFailedDescription")}
                action={
                    <Button variant="secondary" onPress={() => void refetch()}>
                        {t("common.tryAgain")}
                    </Button>
                }
            />
        );
    }

    return (
        <ManageBookingView
            token={token}
            data={data}
            initialMode={initialMode}
            confirmation={{ isPending: confirmAttendance.isPending, isError: confirmAttendance.isError }}
        />
    );
};

export default ManageBookingPage;

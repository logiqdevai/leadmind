import { useState, type FC } from "react";
import { Alert, Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BookingSlot, PublicBookingPolicy, PublicBookingSummary } from "@/features/bookings/interfaces/bookings.interfaces";
import {
    useManagedBookingSlots,
    useRescheduleManagedBooking,
} from "@/features/bookings/hooks/use-public-booking";
import { isSlotUnavailableError } from "@/features/bookings/utils/booking-api-error";
import { formatDateTime } from "@/features/bookings/utils/booking-time";
import { ActionButtonWithPending } from "@/components/ui/action-button-with-pending";
import { useBookingSlotPicker } from "@/pages/booking/hooks/use-booking-slot-picker";
import { BookingSlotPicker } from "@/pages/booking/components/booking-slot-picker";

interface ManageReschedulePanelProps {
    token: string;
    booking: PublicBookingSummary;
    policy: Pick<PublicBookingPolicy, "max_advance_days" | "show_timezone">;
    onDone: (newStart: string, timezone: string) => void;
    onClose: () => void;
}

export const ManageReschedulePanel: FC<ManageReschedulePanelProps> = ({ token, booking, policy, onDone, onClose }) => {
    const { t } = useTranslation();
    const [timezone, setTimezone] = useState(booking.timezone);
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
    const [slotTaken, setSlotTaken] = useState(false);

    const picker = useBookingSlotPicker({ timezone, maxAdvanceDays: policy.max_advance_days ?? undefined });
    const slotsQuery = useManagedBookingSlots(token, picker.range ? { ...picker.range, timezone } : null);
    const reschedule = useRescheduleManagedBooking(token);

    const submit = () => {
        if (!selectedSlot) return;
        reschedule.mutate(
            { start_at: selectedSlot.start, timezone },
            {
                onSuccess: () => onDone(selectedSlot.start, timezone),
                onError: (error) => {
                    if (!isSlotUnavailableError(error)) return;
                    setSelectedSlot(null);
                    setSlotTaken(true);
                },
            },
        );
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-foreground">{t("booking.manage.pickNewTime")}</h2>
                <p className="text-sm text-muted">
                    {t("booking.manage.currently", { when: formatDateTime(booking.start_at, timezone) })}
                </p>
            </div>

            <BookingSlotPicker
                picker={picker}
                timezone={timezone}
                onTimezoneChange={
                    policy.show_timezone
                        ? (tz) => {
                              setTimezone(tz);
                              setSelectedSlot(null);
                          }
                        : undefined
                }
                slots={slotsQuery.data}
                isLoading={slotsQuery.isLoading}
                isFetching={slotsQuery.isFetching && !slotsQuery.isLoading}
                isError={slotsQuery.isError}
                onRetry={() => void slotsQuery.refetch()}
                selectedStart={selectedSlot?.start ?? null}
                onSelectSlot={(slot) => {
                    setSelectedSlot(slot);
                    setSlotTaken(false);
                    reschedule.reset();
                }}
                notice={
                    slotTaken ? (
                        <Alert status="warning">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Title>{t("booking.slotTaken.title")}</Alert.Title>
                                <Alert.Description>{t("booking.slotTaken.descriptionShort")}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null
                }
            />

            {reschedule.isError && !slotTaken ? (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>{t("booking.manage.rescheduleFailed")}</Alert.Title>
                        <Alert.Description>{reschedule.error.message}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            <div className="flex flex-col gap-3 rounded-xl bg-surface-secondary/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex flex-wrap items-center gap-2 text-sm text-foreground" aria-live="polite">
                    {selectedSlot ? (
                        <>
                            <span className="text-muted line-through">{formatDateTime(booking.start_at, timezone)}</span>
                            <ArrowRight className="size-4 text-muted" aria-hidden />
                            <span className="font-semibold">{formatDateTime(selectedSlot.start, timezone)}</span>
                        </>
                    ) : (
                        <span className="text-muted">{t("booking.manage.noNewTime")}</span>
                    )}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="secondary" onPress={onClose} isDisabled={reschedule.isPending}>
                        {t("common.back")}
                    </Button>
                    <ActionButtonWithPending
                        variant="primary"
                        isPending={reschedule.isPending}
                        isDisabled={!selectedSlot || reschedule.isPending}
                        onPress={submit}
                    >
                        {t("booking.manage.confirmNewTime")}
                    </ActionButtonWithPending>
                </div>
            </div>
        </div>
    );
};

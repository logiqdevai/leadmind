import { useState, type FC } from "react";
import { Alert, Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
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
                <h2 className="text-lg font-semibold text-foreground">Pick a new time</h2>
                <p className="text-sm text-muted">
                    Currently {formatDateTime(booking.start_at, timezone)}. Choose a new slot below.
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
                                <Alert.Title>That time was just taken</Alert.Title>
                                <Alert.Description>Please choose another time.</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null
                }
            />

            {reschedule.isError && !slotTaken ? (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Could not reschedule</Alert.Title>
                        <Alert.Description>{reschedule.error.message}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}

            <div className="flex flex-col gap-3 rounded-xl bg-surface-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex flex-wrap items-center gap-2 text-sm text-foreground" aria-live="polite">
                    {selectedSlot ? (
                        <>
                            <span className="text-muted line-through">{formatDateTime(booking.start_at, timezone)}</span>
                            <ArrowRight className="size-4 text-muted" aria-hidden />
                            <span className="font-semibold">{formatDateTime(selectedSlot.start, timezone)}</span>
                        </>
                    ) : (
                        <span className="text-muted">No new time selected yet.</span>
                    )}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="secondary" onPress={onClose} isDisabled={reschedule.isPending}>
                        Back
                    </Button>
                    <ActionButtonWithPending
                        variant="primary"
                        isPending={reschedule.isPending}
                        isDisabled={!selectedSlot || reschedule.isPending}
                        onPress={submit}
                    >
                        Confirm new time
                    </ActionButtonWithPending>
                </div>
            </div>
        </div>
    );
};

import { useEffect, useRef, useState, type FC } from "react";
import { Alert, Button } from "@heroui/react";
import { CalendarDays } from "lucide-react";
import type {
    BookingSlot,
    PublicBookingPage,
    PublicBookingResult,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { useCreatePublicBooking, usePublicBookingSlots } from "@/features/bookings/hooks/use-public-booking";
import { isSlotUnavailableError } from "@/features/bookings/utils/booking-api-error";
import { formatDateTime, formatDuration } from "@/features/bookings/utils/booking-time";
import { getBrowserTimezone } from "@/lib/timezone";
import { useBookingSlotPicker } from "@/pages/booking/hooks/use-booking-slot-picker";
import { resolveBrowserTimezone } from "@/pages/booking/utils/booking-dates";
import { toBookingPayloadDetails } from "@/pages/booking/utils/booking-details";
import type { BookingDetailsFormValues } from "@/pages/booking/validation-schemas/booking.schema";
import { BookingBrandScope } from "@/pages/booking/components/booking-brand-scope";
import { BookingCard } from "@/pages/booking/components/booking-card";
import { BookingPageHeader } from "@/pages/booking/components/booking-page-header";
import { BookingSlotPicker } from "@/pages/booking/components/booking-slot-picker";
import { BookingDetailsForm } from "@/pages/booking/components/booking-details-form";
import { BookingReview } from "@/pages/booking/components/booking-review";
import { BookingConfirmation } from "@/pages/booking/components/booking-confirmation";

const BookingSteps = {
    PICK: "PICK",
    DETAILS: "DETAILS",
    REVIEW: "REVIEW",
} as const;
type BookingStep = (typeof BookingSteps)[keyof typeof BookingSteps];

const STEP_TITLES: Record<BookingStep, string> = {
    [BookingSteps.PICK]: "Select a date and time",
    [BookingSteps.DETAILS]: "Your details",
    [BookingSteps.REVIEW]: "Review and confirm",
};

const STEP_NUMBERS: Record<BookingStep, number> = {
    [BookingSteps.PICK]: 1,
    [BookingSteps.DETAILS]: 2,
    [BookingSteps.REVIEW]: 3,
};

interface BookingFlowProps {
    code: string;
    data: PublicBookingPage;
}

export const BookingFlow: FC<BookingFlowProps> = ({ code, data }) => {
    const { page } = data;
    const defaultTimezone = getBrowserTimezone() ?? resolveBrowserTimezone() ?? data.default_timezone;

    const [timezoneChoice, setTimezoneChoice] = useState<string | null>(null);
    const timezone = timezoneChoice ?? defaultTimezone;
    const [duration, setDuration] = useState(page.default_duration);
    const [memberUuid, setMemberUuid] = useState<string | null>(null);
    const [step, setStep] = useState<BookingStep>(BookingSteps.PICK);
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
    const [details, setDetails] = useState<BookingDetailsFormValues | null>(null);
    const [slotTaken, setSlotTaken] = useState(false);
    const [result, setResult] = useState<PublicBookingResult | null>(null);

    const picker = useBookingSlotPicker({ timezone, maxAdvanceDays: page.max_advance_days });
    const slotsQuery = usePublicBookingSlots(
        code,
        picker.range
            ? {
                  ...picker.range,
                  timezone,
                  duration,
                  member_uuid: page.allow_member_choice ? (memberUuid ?? undefined) : undefined,
              }
            : null,
    );
    const createBooking = useCreatePublicBooking(code);

    // Move keyboard / screen-reader focus to the step heading whenever the step changes.
    const headingRef = useRef<HTMLHeadingElement>(null);
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        headingRef.current?.focus();
    }, [step, result]);

    const memberName = memberUuid ? (page.members.find((m) => m.uuid === memberUuid)?.name ?? null) : null;

    const goTo = (next: BookingStep) => {
        createBooking.reset();
        setStep(next);
    };

    const resetSlot = () => setSelectedSlot(null);

    const confirm = () => {
        if (!selectedSlot || !details) return;
        createBooking.mutate(
            {
                start_at: selectedSlot.start,
                duration_minutes: duration,
                timezone,
                member_uuid: page.allow_member_choice ? (memberUuid ?? undefined) : undefined,
                ...toBookingPayloadDetails(data, details),
            },
            {
                onSuccess: (booked) => setResult(booked),
                onError: (error) => {
                    if (!isSlotUnavailableError(error)) return;
                    setSelectedSlot(null);
                    setSlotTaken(true);
                    setStep(BookingSteps.PICK);
                },
            },
        );
    };

    if (result) {
        return (
            <BookingBrandScope color={result.booking.primary_color ?? page.primary_color}>
                <BookingCard className="mx-auto max-w-2xl">
                    <BookingConfirmation result={result} />
                </BookingCard>
            </BookingBrandScope>
        );
    }

    return (
        <BookingBrandScope color={page.primary_color}>
            <BookingCard>
                <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
                    <BookingPageHeader
                        data={data}
                        duration={duration}
                        onDurationChange={(minutes) => {
                            setDuration(minutes);
                            resetSlot();
                        }}
                        memberUuid={memberUuid}
                        onMemberChange={(uuid) => {
                            setMemberUuid(uuid);
                            resetSlot();
                        }}
                        isLocked={step !== BookingSteps.PICK}
                    />

                    <section className="flex min-w-0 flex-col gap-5 md:border-l md:border-border/60 md:pl-8">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                Step {STEP_NUMBERS[step]} of 3
                            </span>
                            <h2
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-lg font-semibold text-foreground outline-none"
                            >
                                {STEP_TITLES[step]}
                            </h2>
                        </div>

                        {step !== BookingSteps.PICK && selectedSlot ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-secondary/50 px-4 py-3">
                                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                                    <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
                                    <span className="truncate">
                                        {formatDateTime(selectedSlot.start, timezone)} ({formatDuration(duration)})
                                    </span>
                                </span>
                                <Button
                                    size="sm"
                                    variant="tertiary"
                                    isDisabled={createBooking.isPending}
                                    onPress={() => goTo(BookingSteps.PICK)}
                                >
                                    Change
                                </Button>
                            </div>
                        ) : null}

                        {step === BookingSteps.PICK ? (
                            <BookingSlotPicker
                                picker={picker}
                                timezone={timezone}
                                onTimezoneChange={
                                    page.show_timezone
                                        ? (tz) => {
                                              setTimezoneChoice(tz);
                                              resetSlot();
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
                                    goTo(BookingSteps.DETAILS);
                                }}
                                notice={
                                    slotTaken ? (
                                        <Alert status="warning">
                                            <Alert.Indicator />
                                            <Alert.Content>
                                                <Alert.Title>That time was just taken</Alert.Title>
                                                <Alert.Description>
                                                    Someone booked it a moment ago. Please choose another time; your
                                                    details are saved.
                                                </Alert.Description>
                                            </Alert.Content>
                                        </Alert>
                                    ) : null
                                }
                            />
                        ) : null}

                        {step === BookingSteps.DETAILS ? (
                            <BookingDetailsForm
                                data={data}
                                defaultValues={details}
                                onBack={() => goTo(BookingSteps.PICK)}
                                onSubmit={(values) => {
                                    setDetails(values);
                                    goTo(BookingSteps.REVIEW);
                                }}
                            />
                        ) : null}

                        {step === BookingSteps.REVIEW && selectedSlot && details ? (
                            <BookingReview
                                data={data}
                                slot={selectedSlot}
                                timezone={timezone}
                                duration={duration}
                                memberName={memberName}
                                details={details}
                                isSubmitting={createBooking.isPending}
                                errorMessage={createBooking.isError ? createBooking.error.message : null}
                                onBack={() => goTo(BookingSteps.DETAILS)}
                                onEditTime={() => goTo(BookingSteps.PICK)}
                                onConfirm={confirm}
                            />
                        ) : null}
                    </section>
                </div>
            </BookingCard>
        </BookingBrandScope>
    );
};

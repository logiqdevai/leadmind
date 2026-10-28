import { useEffect, useRef, useState, type FC } from "react";
import { Alert, Button } from "@heroui/react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
    BookingSlot,
    PublicBookingPage,
    PublicPageRef,
    PublicBookingResult,
} from "@/features/bookings/interfaces/bookings.interfaces";
import { useCreatePublicBooking, usePublicBookingSlots } from "@/features/bookings/hooks/use-public-booking";
import { isSlotUnavailableError } from "@/features/bookings/utils/booking-api-error";
import { formatDateLong, formatTimeRange } from "@/features/bookings/utils/booking-time";
import { getCurrentLanguage } from "@/lib/i18n";
import { getBrowserTimezone } from "@/lib/timezone";
import { useBookingSlotPicker } from "@/pages/booking/hooks/use-booking-slot-picker";
import { resolveBrowserTimezone } from "@/pages/booking/utils/booking-dates";
import { formatDurationLocalized } from "@/pages/booking/utils/booking-format";
import { toBookingPayloadDetails } from "@/pages/booking/utils/booking-details";
import type { BookingDetailsFormValues } from "@/pages/booking/validation-schemas/booking.schema";
import { BookingBrandScope } from "@/pages/booking/components/booking-brand-scope";
import { BookingCard } from "@/pages/booking/components/booking-card";
import { BookingStepper } from "@/pages/booking/components/booking-stepper";
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

const STEP_TITLE_KEYS: Record<BookingStep, string> = {
    [BookingSteps.PICK]: "booking.steps.pick",
    [BookingSteps.DETAILS]: "booking.steps.details",
    [BookingSteps.REVIEW]: "booking.steps.review",
};

const STEP_NUMBERS: Record<BookingStep, number> = {
    [BookingSteps.PICK]: 1,
    [BookingSteps.DETAILS]: 2,
    [BookingSteps.REVIEW]: 3,
};

interface BookingFlowProps {
    pageRef: PublicPageRef;
    data: PublicBookingPage;
}

export const BookingFlow: FC<BookingFlowProps> = ({ pageRef, data }) => {
    const { t } = useTranslation();
    const { page } = data;
    // The organisation decides the default; visitors can still switch with the timezone selector.
    const defaultTimezone = data.default_timezone || getBrowserTimezone() || resolveBrowserTimezone() || "UTC";

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
        pageRef,
        picker.range
            ? {
                  ...picker.range,
                  timezone,
                  duration,
                  member_uuid: page.allow_member_choice ? (memberUuid ?? undefined) : undefined,
              }
            : null,
    );
    const createBooking = useCreatePublicBooking(pageRef);

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
                language: getCurrentLanguage(),
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
                <div className="mx-auto max-w-2xl py-4 sm:py-8">
                    <BookingConfirmation result={result} />
                </div>
            </BookingBrandScope>
        );
    }

    return (
        <BookingBrandScope color={page.primary_color}>
            <BookingCard className="overflow-hidden p-0 sm:p-0">
                <div className="grid md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                    <div className="border-b border-border/60 p-6 sm:p-8 md:border-b-0 md:border-r">
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
                    </div>

                    <section className="flex min-w-0 flex-col gap-8 p-5 sm:p-8">
                        <BookingStepper current={STEP_NUMBERS[step]} />

                        {step === BookingSteps.DETAILS ? (
                            <div className="flex flex-col gap-1">
                                <h2
                                    ref={headingRef}
                                    tabIndex={-1}
                                    className="text-2xl font-bold text-foreground outline-none"
                                >
                                    {t(STEP_TITLE_KEYS[step])}
                                </h2>
                                <p className="text-sm text-muted">{t("booking.form.detailsDescription")}</p>
                            </div>
                        ) : step === BookingSteps.REVIEW ? (
                            <h2
                                ref={headingRef}
                                tabIndex={-1}
                                className="text-2xl font-bold text-foreground outline-none"
                            >
                                {t(STEP_TITLE_KEYS[step])}
                            </h2>
                        ) : (
                            <h2 ref={headingRef} tabIndex={-1} className="sr-only">
                                {t(STEP_TITLE_KEYS[step])}
                            </h2>
                        )}

                        {step === BookingSteps.REVIEW && selectedSlot ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-secondary/50 px-4 py-3">
                                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                                    <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
                                    <span className="break-words">
                                        {formatDateLong(selectedSlot.start, timezone)} ({formatDurationLocalized(duration)})
                                    </span>
                                </span>
                                <Button
                                    size="sm"
                                    variant="tertiary"
                                    isDisabled={createBooking.isPending}
                                    onPress={() => goTo(BookingSteps.PICK)}
                                >
                                    {t("common.change")}
                                </Button>
                            </div>
                        ) : null}

                        {step === BookingSteps.PICK ? (
                            <BookingSlotPicker
                                withHeading
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
                                                <Alert.Title>{t("booking.slotTaken.title")}</Alert.Title>
                                                <Alert.Description>
                                                    {t("booking.slotTaken.description")}
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
                                summary={
                                    selectedSlot ? (
                                        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-secondary/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-accent">
                                                    <CalendarDays className="size-5" aria-hidden />
                                                </span>
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="break-words text-sm font-semibold text-foreground">
                                                        {formatDateLong(selectedSlot.start, timezone)}
                                                    </span>
                                                    <span className="break-words text-sm text-muted">
                                                        {formatTimeRange(selectedSlot.start, selectedSlot.end, timezone)}{" "}
                                                        <span className="whitespace-nowrap">
                                                            ({formatDurationLocalized(duration)})
                                                        </span>
                                                    </span>
                                                </span>
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="w-full shrink-0 rounded-full sm:w-auto"
                                                onPress={() => goTo(BookingSteps.PICK)}
                                            >
                                                <CalendarDays className="size-4" aria-hidden />
                                                {t("common.change")}
                                            </Button>
                                        </div>
                                    ) : null
                                }
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
